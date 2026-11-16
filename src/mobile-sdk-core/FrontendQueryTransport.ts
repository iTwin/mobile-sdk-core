/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Base64Converter } from "./Base64Converter";
import { QueryResponse, QueryTransport, TransportQueryHandler } from "./common/MessengerImpl";
import { UIError } from "./common/UIError";

interface MessageBridge {
  postMessage(message: string): void;
  onmessage?: (event: MessageEvent<string>) => void;
}

/* eslint-disable @typescript-eslint/naming-convention -- Native bridge names are a wire contract. */
interface MessengerWindow extends Window {
  Bentley_ITMMessenger?: MessageBridge;
  Bentley_ITMMessengerSecureBridge?: boolean;
  Bentley_ITMMessengerNativeSession?: string;
  Bentley_ITMMessengerDocumentId?: string;
  Bentley_ITMMessengerInitialize?: (sessionId: string) => void;
  Bentley_ITMMessengerReceive?: (message: string) => void;
  webkit?: { messageHandlers?: {
    Bentley_ITMMessenger_Query?: MessageBridge;
    Bentley_ITMMessenger_QueryResponse?: MessageBridge;
  } };
}
/* eslint-enable @typescript-eslint/naming-convention */

const maxPendingQueries = 128;

/** Session-aware WebView transport. @internal */
export class FrontendQueryTransport extends QueryTransport {
  private readonly _view: MessengerWindow;
  private readonly _documentId: string;
  private readonly _queryBridge: MessageBridge;
  private readonly _responseBridge: MessageBridge;
  private _sessionId?: string;
  private _ready = false;
  private _ended = false;
  private _queued: Array<() => void> = [];
  private readonly _pending = new Map<number, { resolve: (response: QueryResponse) => void; reject: (error: Error) => void }>();
  private readonly _incoming = new Set<number>();

  constructor(onQueryReceived: TransportQueryHandler, view: MessengerWindow = window) {
    super(onQueryReceived);
    const android = view.Bentley_ITMMessenger;
    const queryBridge = android ?? view.webkit?.messageHandlers?.Bentley_ITMMessenger_Query;
    const responseBridge = android ?? view.webkit?.messageHandlers?.Bentley_ITMMessenger_QueryResponse;
    if ((!android && view.Bentley_ITMMessengerSecureBridge !== true) ||
        typeof queryBridge?.postMessage !== "function" || typeof responseBridge?.postMessage !== "function")
      throw new Error("Messenger requires a session-aware native bridge.");
    this._view = view;
    this._documentId = Array.from(view.crypto.getRandomValues(new Uint32Array(4))).join("-");
    this._queryBridge = queryBridge;
    this._responseBridge = responseBridge;
    // Install receivers before the ready handshake can produce a native reply.
    if (android) android.onmessage = (event) => this._receive(event.data);
    view.Bentley_ITMMessengerReceive = (message) => this._receive(message);
    view.Bentley_ITMMessengerDocumentId = this._documentId;
    view.Bentley_ITMMessengerInitialize = (sessionId) => this._initialize(sessionId);
    view.addEventListener("pagehide", () => this._end(new Error("Messenger document session ended.")));
    if (typeof view.Bentley_ITMMessengerNativeSession === "string")
      this._initialize(view.Bentley_ITMMessengerNativeSession);
  }

  private _end(error: Error) {
    this._ended = true;
    this._ready = false;
    this._queued = [];
    this._incoming.clear();
    for (const pending of this._pending.values()) pending.reject(error);
    this._pending.clear();
  }

  private _fail(error: Error) {
    if (this._ended) return;
    this._end(error);
    try {
      if (this._sessionId !== undefined) this._post(this._queryBridge, { operation: "closed" });
    } catch {
      console.error("Messenger transport failed; native cleanup will occur on document teardown."); // eslint-disable-line no-console
    }
  }

  private _initialize(sessionId: string) {
    if (sessionId === this._sessionId && !this._ended) return;
    if (this._sessionId !== undefined) this._end(new Error("Messenger document session replaced."));
    this._sessionId = sessionId;
    this._ended = false;
    try {
      this._post(this._queryBridge, { operation: "ready" });
    } catch (error) {
      this._fail(error instanceof Error ? error : new Error("Messenger handshake failed."));
    }
  }

  private _post(bridge: MessageBridge, message: object) {
    const payload = JSON.stringify({ ...message, sessionId: this._sessionId, documentId: this._documentId });
    bridge.postMessage(payload);
  }

  private _receive(payload: string) {
    try {
      const message: unknown = JSON.parse(payload);
      if (!message || typeof message !== "object") throw new Error("Invalid Messenger envelope.");
      const envelope = message as Record<string, unknown>;
      if (this._ended || envelope.sessionId !== this._sessionId || envelope.documentId !== this._documentId) return;
      if (envelope.operation === "closed") {
        this._end(new Error("Messenger document session ended."));
        return;
      }
      if (envelope.operation === "ready") {
        if (this._ready) return;
        this._ready = true;
        const queued = this._queued;
        this._queued = [];
        queued.forEach((send) => send());
        return;
      }
      if (!this._ready || typeof envelope.queryId !== "number" || !Number.isSafeInteger(envelope.queryId) || envelope.queryId < 0)
        throw new Error("Invalid Messenger query ID.");
      const queryId = envelope.queryId;
      if (envelope.operation === "queryResponse") {
        const pending = this._pending.get(queryId);
        if (!pending) return;
        if (typeof envelope.message !== "string") throw new Error("Invalid Messenger response.");
        const response: unknown = JSON.parse(Base64Converter.base64Utf8ToString(envelope.message));
        if (!response || typeof response !== "object") throw new Error("Invalid Messenger response.");
        const result = response as Record<string, unknown>;
        this._pending.delete(queryId);
        pending.resolve({ data: result.response, error: result.error, isUnhandled: result.unhandled === true });
      } else if (envelope.operation === "query") {
        if (typeof envelope.name !== "string" || typeof envelope.message !== "string") throw new Error("Invalid Messenger query.");
        if (this._incoming.has(queryId)) return;
        if (this._incoming.size >= maxPendingQueries) {
          this._post(this._responseBridge, { operation: "queryResponse", queryId, error: "Messenger request limit reached." });
          return;
        }
        const decoded = Base64Converter.base64Utf8ToString(envelope.message);
        this._incoming.add(queryId);
        void this._handleQuery(envelope.name, queryId, decoded, this._sessionId);
      } else {
        throw new Error("Unknown Messenger operation.");
      }
    } catch (error) {
      this._fail(error instanceof Error ? error : new Error("Messenger transport failed."));
    }
  }

  private async _handleQuery(name: string, queryId: number, message: string, sessionId: string | undefined) {
    let response: object;
    try {
      if (message !== "") JSON.parse(message);
      response = { response: await this._onQueryReceived(name, message) };
    } catch (error) {
      response = { error: UIError.create(error) };
    }
    if (this._ended || this._sessionId !== sessionId) return;
    this._incoming.delete(queryId);
    try {
      this._post(this._responseBridge, { operation: "queryResponse", queryId, ...response });
    } catch {
      try {
        this._post(this._responseBridge, { operation: "queryResponse", queryId, error: "Messenger response serialization or delivery failed." });
      } catch (error) {
        this._fail(error instanceof Error ? error : new Error("Messenger response delivery failed."));
      }
    }
  }

  public async sendQuery(name: string, queryId: number, message: unknown): Promise<QueryResponse> {
    if (this._ended) throw new Error("Messenger document session ended.");
    if (this._pending.size >= maxPendingQueries) throw new Error("Messenger request limit reached.");
    return new Promise<QueryResponse>((resolve, reject) => {
      this._pending.set(queryId, { resolve, reject });
      const send = () => {
        try {
          this._post(this._queryBridge, { operation: "query", name, queryId, message });
        } catch (error) {
          this._pending.delete(queryId);
          reject(error instanceof Error ? error : new Error("Messenger request delivery failed."));
        }
      };
      if (this._ready) send();
      else this._queued.push(send);
    });
  }
}
