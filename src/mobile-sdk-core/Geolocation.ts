/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Base64Converter } from "./Base64Converter";

// Note: Nothing is exported from this file, and that is intentional. This is an
// iOS and Android Polyfill for navigator.geolocation.

const anyWindow: any = window;

interface WatchPositionHandler {
  successCallback: PositionCallback;
  errorCallback?: PositionErrorCallback;
}

interface BentleyGeolocation {
  lastId: number;
  positionHandlers: { [key: number]: WatchPositionHandler };
}

const geolocationData = {
  watch: {
    lastId: 0,
    positionHandlers: {},
  } as BentleyGeolocation,
  position: {
    lastId: 0,
    positionHandlers: {},
  } as BentleyGeolocation,
};

const anyGeolocation: any = navigator.geolocation;

const androidBridge = anyWindow.Bentley_ITMGeolocation;
const iosBridge = anyWindow.webkit?.messageHandlers.Bentley_ITMGeolocation;
const secureBridge = typeof androidBridge?.postMessage === "function" || anyWindow.Bentley_ITMGeolocationSecureBridge === true;
const documentId = secureBridge ? Array.from(window.crypto.getRandomValues(new Uint32Array(4))).join("-") : undefined;
let sessionId: string | undefined;
let sessionReady = false;
let pendingRequests: Array<() => void> = [];

function postRequest(messageName: string, positionId: number, options?: PositionOptions) {
  const send = () => {
    const handlers = messageName === "watchPosition" ? geolocationData.watch : geolocationData.position;
    const handler = messageName === "clearWatch" ? undefined : handlers.positionHandlers[positionId];
    if (messageName !== "clearWatch" && !handler) return;
    try {
      const message = JSON.stringify({ messageName, positionId, sessionId, documentId, options });
      if (typeof androidBridge?.postMessage === "function") {
        androidBridge.postMessage(message);
      } else {
        iosBridge.postMessage(message);
      }
    } catch {
      if (!handler) {
        console.error("Unable to send geolocation watch cancellation."); // eslint-disable-line no-console
        return;
      }
      delete handlers.positionHandlers[positionId];
      try {
        handler.errorCallback?.({ code: 2, message: "Unable to send geolocation request.", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }); // eslint-disable-line @typescript-eslint/naming-convention
      } catch {
        console.error("Geolocation error callback failed after request failure."); // eslint-disable-line no-console
      }
    }
  };
  if (sessionReady) {
    send();
  } else {
    pendingRequests.push(send);
  }
}

function initializeSession(nativeSessionId: string) {
  if (sessionId === nativeSessionId) return;
  const replacingSession = sessionId !== undefined;
  sessionId = nativeSessionId;
  sessionReady = false;
  if (replacingSession) {
    pendingRequests = [];
    const staleHandlers = [...Object.values(geolocationData.watch.positionHandlers), ...Object.values(geolocationData.position.positionHandlers)];
    geolocationData.watch.positionHandlers = {};
    geolocationData.position.positionHandlers = {};
    for (const handler of staleHandlers) {
      try {
        handler.errorCallback?.({ code: 2, message: "Geolocation document session ended.", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }); // eslint-disable-line @typescript-eslint/naming-convention
      } catch {
        console.error("Geolocation error callback failed during session cleanup."); // eslint-disable-line no-console
      }
    }
  }
  const message = JSON.stringify({ messageName: "ready", sessionId, documentId });
  if (typeof androidBridge?.postMessage === "function") {
    androidBridge.postMessage(message);
  } else {
    iosBridge.postMessage(message);
  }
}

function watchPosition(successCallback: PositionCallback, errorCallback?: PositionErrorCallback, options?: PositionOptions) {
  const positionId = ++geolocationData.watch.lastId;
  geolocationData.watch.positionHandlers[positionId] = { successCallback, errorCallback };

  if (secureBridge) {
    postRequest("watchPosition", positionId, typeof androidBridge?.postMessage === "function" ? undefined : options);
    return positionId;
  }

  // Try using Android interface
  anyWindow.Bentley_ITMGeolocation?.watchPosition(positionId);

  // Try using iOS interface
  anyWindow.webkit?.messageHandlers.Bentley_ITMGeolocation.postMessage(JSON.stringify({
    messageName: "watchPosition",
    positionId,
    options,
  }));
  return positionId;
}

function clearWatch(positionId: number) {
  if (!geolocationData.watch.positionHandlers[positionId]) return;
  delete geolocationData.watch.positionHandlers[positionId];

  if (secureBridge) {
    try {
      postRequest("clearWatch", positionId);
    } catch {
      console.error("Unable to enqueue geolocation watch cancellation."); // eslint-disable-line no-console
    }
    return;
  }

  // Try using Android interface
  anyWindow.Bentley_ITMGeolocation?.clearWatch(positionId);

  // Try using iOS interface
  anyWindow.webkit?.messageHandlers.Bentley_ITMGeolocation.postMessage(JSON.stringify({
    messageName: "clearWatch",
    positionId,
  }));
}

function getCurrentPosition(successCallback: PositionCallback, errorCallback?: PositionErrorCallback, options?: PositionOptions) {
  const positionId = ++geolocationData.position.lastId;
  geolocationData.position.positionHandlers[positionId] = { successCallback, errorCallback };

  if (secureBridge) {
    postRequest("getCurrentPosition", positionId, typeof androidBridge?.postMessage === "function" ? undefined : options);
    return;
  }

  // Try using Android interface
  anyWindow.Bentley_ITMGeolocation?.getCurrentPosition(positionId);

  // Try using iOS interface
  anyWindow.webkit?.messageHandlers.Bentley_ITMGeolocation.postMessage(JSON.stringify({
    messageName: "getCurrentPosition",
    positionId,
    options,
  }));
}

function positionUpdate(messageData: string, geolocation: BentleyGeolocation) {
  const message = JSON.parse(Base64Converter.base64Utf8ToString(messageData));
  const handler = geolocation.positionHandlers[message.positionId];
  if (!handler) return undefined;
  const position: GeolocationPosition = message.position;
  const error: GeolocationPositionError = message.error;
  if (position) {
    handler.successCallback(position);
  } else if (handler.errorCallback && error) {
    handler.errorCallback(error);
  }
  return message.positionId;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function Bentley_ITMGeolocationResponse(messageName: string, messageData: string, responseSessionId?: string, responseDocumentId?: string) {
  if (secureBridge) {
    if (responseSessionId !== sessionId || responseDocumentId !== documentId) return;
    if (messageName === "ready") {
      if (sessionReady) return;
      sessionReady = true;
      const requests = pendingRequests;
      pendingRequests = [];
      requests.forEach((send) => send());
      return;
    }
    if (!sessionReady) return;
  }
  switch (messageName) {
    case "watchPosition":
      positionUpdate(messageData, geolocationData.watch);
      break;
    case "getCurrentPosition":
      const positionId = positionUpdate(messageData, geolocationData.position);
      if (positionId) {
        delete geolocationData.position.positionHandlers[positionId];
      }
      break;
    default:
      console.error(`Unknown message name (${messageName}) in Bentley_ITMGeolocation call.`); // eslint-disable-line no-console
      break;
  }
}

if (anyWindow.Bentley_ITMGeolocation !== undefined || anyWindow.webkit?.messageHandlers.Bentley_ITMGeolocation !== undefined) {
  anyGeolocation.watchPosition = watchPosition;
  anyGeolocation.clearWatch = clearWatch;
  anyGeolocation.getCurrentPosition = getCurrentPosition;
  anyWindow.Bentley_ITMGeolocationResponse = Bentley_ITMGeolocationResponse;
  if (secureBridge) {
    anyWindow.Bentley_ITMGeolocationDocumentId = documentId;
    anyWindow.Bentley_ITMGeolocationInitialize = initializeSession;
    if (typeof androidBridge?.postMessage === "function") {
      androidBridge.onmessage = (event: MessageEvent<string>) => {
        const response = JSON.parse(event.data);
        Bentley_ITMGeolocationResponse(response.messageName, response.messageData, response.sessionId, response.documentId);
      };
    }
    if (typeof anyWindow.Bentley_ITMGeolocationNativeSession === "string") {
      initializeSession(anyWindow.Bentley_ITMGeolocationNativeSession);
    }
  }
}
