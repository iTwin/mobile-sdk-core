/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");
const { test } = require("node:test");
const { FrontendQueryTransport } = require("../lib/mobile-sdk-core/FrontendQueryTransport");
const { MessengerImpl } = require("../lib/mobile-sdk-core/common/MessengerImpl");

function fixture(platform = "android", handler = async () => undefined) {
  const sent = [];
  const events = {};
  const queryBridge = { postMessage: (message) => sent.push(JSON.parse(message)) };
  const responseBridge = { postMessage: (message) => sent.push(JSON.parse(message)) };
  const view = { crypto: webcrypto, addEventListener: (name, callback) => { events[name] = callback; } };
  if (platform === "android") view.Bentley_ITMMessenger = queryBridge;
  else {
    view.Bentley_ITMMessengerSecureBridge = true;
    view.webkit = { messageHandlers: { Bentley_ITMMessenger_Query: queryBridge, Bentley_ITMMessenger_QueryResponse: responseBridge } };
  }
  const transport = new FrontendQueryTransport(handler, view);
  const receive = (message) => {
    const data = JSON.stringify({ sessionId: "session-1", documentId: view.Bentley_ITMMessengerDocumentId, ...message });
    if (platform === "android") queryBridge.onmessage({ data });
    else view.Bentley_ITMMessengerReceive(data);
  };
  const ready = () => {
    view.Bentley_ITMMessengerInitialize("session-1");
    receive({ operation: "ready" });
  };
  const response = (queryId, message, extra = {}) => receive({
    operation: "queryResponse", queryId, message: Buffer.from(JSON.stringify(message)).toString("base64"), ...extra,
  });
  return { transport, view, sent, events, receive, ready, response, queryBridge, responseBridge };
}

for (const platform of ["android", "ios"]) {
  test(`${platform}: reject legacy native bridges before installing document callbacks`, () => {
    const view = {
      crypto: webcrypto,
      addEventListener: () => assert.fail("Must not install document callbacks for an unsupported bridge"),
    };
    const unsupportedCall = () => assert.fail("Must not send legacy messages");
    if (platform === "android") {
      view.Bentley_ITMMessenger = { query: unsupportedCall, queryResponse: unsupportedCall };
    } else {
      view.webkit = { messageHandlers: {
        Bentley_ITMMessenger_Query: { postMessage: unsupportedCall },
        Bentley_ITMMessenger_QueryResponse: { postMessage: unsupportedCall },
      } };
    }
    assert.throws(() => new FrontendQueryTransport(async () => undefined, view), /requires a session-aware native bridge/);
  });

  test(`${platform}: queue startup queries until the ready reply and correlate out-of-order Unicode results`, async () => {
    const f = fixture(platform);
    const first = f.transport.sendQuery("first", 0, "hello");
    const second = f.transport.sendQuery("second", 1, { value: "world" });
    assert.equal(f.sent.length, 0);
    f.view.Bentley_ITMMessengerInitialize("session-1");
    assert.deepEqual(f.sent.map((m) => m.operation), ["ready"]);
    f.receive({ operation: "ready" });
    assert.deepEqual(f.sent.slice(1).map((m) => m.queryId), [0, 1]);
    f.response(1, { response: "\u4e16\u754c \ud83c\udf0d" });
    f.response(0, { response: { greeting: "h\u00e9llo" } });
    assert.equal((await second).data, "\u4e16\u754c \ud83c\udf0d");
    assert.deepEqual((await first).data, { greeting: "h\u00e9llo" });
  });

  test(`${platform}: native queries retain errors, Unicode, and safe query names`, async () => {
    const received = [];
    const f = fixture(platform, async (name, message) => {
      received.push([name, JSON.parse(message)]);
      if (name === "error") throw new Error("handler failed");
      return "\u00e9";
    });
    f.ready();
    const request = (name, queryId) => f.receive({
      operation: "query", name, queryId, message: Buffer.from(JSON.stringify({ value: "\u4e16\u754c" })).toString("base64"),
    });
    request("quoted'\\name", 42);
    request("error", 43);
    await new Promise(setImmediate);
    assert.equal(received[0][0], "quoted'\\name");
    assert.deepEqual(received[0][1], { value: "\u4e16\u754c" });
    assert.equal(f.sent.find((m) => m.queryId === 42).response, "\u00e9");
    assert.equal(f.sent.find((m) => m.queryId === 43).error.Description, "handler failed");
  });

  test(`${platform}: wrong-session replies and late handlers cannot affect a replacement session`, async () => {
    let finish;
    const f = fixture(platform, () => new Promise((resolve) => { finish = resolve; }));
    f.ready();
    const pending = f.transport.sendQuery("pending", 1);
    const rejected = assert.rejects(pending, /session replaced/);
    f.response(1, { response: "forged" }, { sessionId: "wrong" });
    f.receive({ operation: "query", name: "delayed", queryId: 7, message: Buffer.from("{}").toString("base64") });
    f.view.Bentley_ITMMessengerInitialize("session-2");
    await rejected;
    finish("late result");
    await new Promise(setImmediate);
    assert.equal(f.sent.filter((m) => m.queryId === 7).length, 0);
    const next = f.transport.sendQuery("next", 2);
    f.receive({ operation: "ready", sessionId: "session-2" });
    f.response(2, { response: "current" }, { sessionId: "session-2" });
    assert.equal((await next).data, "current");
  });

  test(`${platform}: pagehide and native teardown reject queued and active queries`, async () => {
    const queued = fixture(platform);
    const waiting = queued.transport.sendQuery("queued", 0);
    const waitingRejected = assert.rejects(waiting, /session ended/);
    queued.events.pagehide();
    await waitingRejected;
    assert.equal(queued.sent.length, 0);
    await assert.rejects(queued.transport.sendQuery("after", 1), /session ended/);
    const active = fixture(platform);
    active.ready();
    const pending = active.transport.sendQuery("active", 0);
    const rejected = assert.rejects(pending, /session ended/);
    active.receive({ operation: "closed" });
    await rejected;
  });

  test(`${platform}: serialization and bridge failures settle queries and release callback registrations`, async () => {
    const f = fixture(platform);
    f.ready();
    const cyclic = {};
    cyclic.self = cyclic;
    await assert.rejects(f.transport.sendQuery("cyclic", 1, cyclic), /circular/i);
    f.queryBridge.postMessage = () => { throw new Error("bridge unavailable"); };
    await assert.rejects(f.transport.sendQuery("failed", 3), /bridge unavailable/);
    assert.equal(Object.keys(f.view).some((key) => /QueryResponse\d/.test(key)), false);
  });

  test(`${platform}: exchange large query and response payloads in both directions`, async () => {
    const message = "x".repeat(1_048_577);
    const f = fixture(platform, async (_name, body) => JSON.parse(body));
    f.ready();
    const pending = f.transport.sendQuery("large", 0, message);
    assert.equal(f.sent.at(-1).message, message);
    f.response(0, { response: message });
    assert.equal((await pending).data, message);
    f.receive({
      operation: "query", name: "large", queryId: 1,
      message: Buffer.from(JSON.stringify(message)).toString("base64"),
    });
    await new Promise(setImmediate);
    assert.equal(f.sent.find((entry) => entry.operation === "queryResponse" && entry.queryId === 1).response, message);
  });
}

test("malformed native responses reject pending work instead of returning success-shaped defaults", async () => {
  const f = fixture();
  f.ready();
  const pending = f.transport.sendQuery("bad-response", 1);
  const rejected = assert.rejects(pending, /JSON|Unexpected|Invalid/);
  f.receive({ operation: "queryResponse", queryId: 1, message: Buffer.from("{").toString("base64") });
  await rejected;
});

test("public query semantics retain unhandled and structured errors", async () => {
  const f = fixture();
  const impl = new MessengerImpl();
  impl.initialize(() => f.transport);
  f.ready();
  const unhandled = impl.query("unhandled");
  const rejected = assert.rejects(unhandled, /unhandled/i);
  f.response(0, { unhandled: true });
  await rejected;
  const failed = impl.query("failed");
  const failedRejected = assert.rejects(failed, /native failure/);
  f.response(1, { error: "native failure" });
  await failedRejected;
});

test("pending-query limit accepts the boundary and rejects the next request", async () => {
  const f = fixture();
  f.ready();
  const pending = Array.from({ length: 128 }, (_, id) => f.transport.sendQuery("limit", id));
  await assert.rejects(f.transport.sendQuery("over-limit", 129), /request limit/);
  pending.forEach((_, id) => f.response(id, { response: id }));
  assert.equal((await Promise.all(pending)).length, 128);
});

test("invalid handler JSON and unserializable handler responses produce errors without leaking native queries", async () => {
  let invoked = false;
  const f = fixture("ios", async () => {
    invoked = true;
    const cyclic = {};
    cyclic.self = cyclic;
    return cyclic;
  });
  f.ready();
  f.receive({ operation: "query", name: "bad-json", queryId: 1, message: Buffer.from("{").toString("base64") });
  await new Promise(setImmediate);
  assert.equal(invoked, false);
  assert.ok(f.sent.find((message) => message.queryId === 1).error);
  f.receive({ operation: "query", name: "cyclic", queryId: 2, message: Buffer.from("{}").toString("base64") });
  await new Promise(setImmediate);
  assert.match(f.sent.find((message) => message.queryId === 2).error, /serialization/);
});
