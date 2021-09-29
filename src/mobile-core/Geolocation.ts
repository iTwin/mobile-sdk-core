/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Base64Converter } from ".";

// Note: Nothing is exported from this file, and that is intentionl. This is an
// iOS and Android Polyfill for navigator.geolocation.

// tslint:disable: only-arrow-functions

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

function watchPosition(successCallback: PositionCallback, errorCallback?: PositionErrorCallback, options?: PositionOptions) {
  const positionId = ++geolocationData.watch.lastId;
  geolocationData.watch.positionHandlers[positionId] = { successCallback, errorCallback };

  // Try using Android interface
  anyWindow.androidAppGeolocationInterface?.watchPosition(positionId);

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

  // Try using Android interface
  anyWindow.androidAppGeolocationInterface?.clearWatch(positionId);

  // Try using iOS interface
  anyWindow.webkit?.messageHandlers.Bentley_ITMGeolocation.postMessage(JSON.stringify({
    messageName: "clearWatch",
    positionId,
  }));
  delete geolocationData.watch.positionHandlers[positionId];
}

function getCurrentPosition(successCallback: PositionCallback, errorCallback?: PositionErrorCallback, options?: PositionOptions) {
  const positionId = ++geolocationData.position.lastId;
  geolocationData.position.positionHandlers[positionId] = { successCallback, errorCallback };

  // Try using Android interface
  anyWindow.androidAppGeolocationInterface?.getCurrentPosition(positionId);

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

function Bentley_ITMGeolocation(messageName: string, messageData: string) {
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
      console.error("Unknown message name (" + messageName + ") in Bentley_ITMGeolocation call.");
      break;
  }
}

if (anyWindow.androidAppGeolocationInterface !== undefined || anyWindow.webkit?.messageHandlers.Bentley_ITMGeolocation !== undefined) {
  anyGeolocation.watchPosition = watchPosition;
  anyGeolocation.clearWatch = clearWatch;
  anyGeolocation.getCurrentPosition = getCurrentPosition;
  anyWindow.Bentley_ITMGeolocation = Bentley_ITMGeolocation;
}
