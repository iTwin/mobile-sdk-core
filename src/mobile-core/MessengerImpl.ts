/*---------------------------------------------------------------------------------------------
* Copyright (c) 2021 Bentley Systems, Incorporated. All rights reserved.
*--------------------------------------------------------------------------------------------*/
import {
  Base64Converter,
  MessageNotImplementedError,
  Messenger,
  MobileCore,
  UIError,
} from ".";

// MessengerImpl implementation that works with iOS and Android.
// Note: Incoming data from native side is BASE64-encoded UTF-8. For any data that is
// pure ASCII, JavaScript's builtin atob() function would decode it. However, any
// data that includes non-ASCII would not decode properly via atob(), so
// Base64Converter.base64Utf8ToString() is used instead.

/**
 * @internal
 */
export class MessengerImpl {
  private static _anyWindow: any = window;
  private static _queryId = 0;
  private static _queryResponse: (responseJson: string) => void;
  private static _query: (messageJson: string) => void;

  public static initialize() {
    if (MessengerImpl._anyWindow.webkit) {
      // iOS
      MessengerImpl._queryResponse = (responseJson) => MessengerImpl._anyWindow.webkit.messageHandlers.Bentley_ITMMessenger_QueryResponse.postMessage(responseJson);
      MessengerImpl._query = (messageJson) => MessengerImpl._anyWindow.webkit.messageHandlers.Bentley_ITMMessenger_Query.postMessage(messageJson);
    } else if (MessengerImpl._anyWindow.Bentley_ITMMessenger) {
      // Android
      MessengerImpl._queryResponse = (responseJson) => MessengerImpl._anyWindow.Bentley_ITMMessenger.queryResponse(responseJson);
      MessengerImpl._query = (messageJson) => MessengerImpl._anyWindow.Bentley_ITMMessenger.query(messageJson);
    } else {
      throw new Error("This MessengerImpl only supports iOS and Android.");
    }

    MessengerImpl._anyWindow.Bentley_ITMMessenger_Query = async (name: string, queryId: number, messageJson: string) => {
      const message: any = { queryId };
      try {
        const response = await MessengerImpl.receiveQuery(name, messageJson);
        message.response = response;
      } catch (error) {
        message.error = UIError.create(error);
      }
      MessengerImpl._queryResponse(JSON.stringify(message));
    };
  }

  public static async query(name: string, message?: any) {
    const responseName = "Bentley_ITMMessenger_QueryResponse" + MessengerImpl._queryId;
    const messageResponse = new Promise<string | undefined>((resolve) => {
      MessengerImpl._anyWindow[responseName] = resolve;
    });

    MessengerImpl._query(JSON.stringify({ name, message, queryId: MessengerImpl._queryId++ }));

    const messageJson = await messageResponse;
    delete MessengerImpl._anyWindow[responseName];
    if (messageJson !== undefined) {
      let parsedMessage: any;  // Have to rename this, since it's now colliding w/ the message arg
      try {
        // See note before class.
        parsedMessage = JSON.parse(Base64Converter.base64Utf8ToString(messageJson));
      } catch (ex) {
        // ignore
      }
      return parsedMessage;
    } else {
      throw new Error(MobileCore.translate("messenger.query-response-error", { name }));
    }
  }

  private static async receiveQuery(name: string, messageJson: string) {
    const queryHandler = Messenger.queryHandlers[name];
    if (queryHandler) {
      let message;
      try {
        // See note before class.
        message = JSON.parse(Base64Converter.base64Utf8ToString(messageJson));
      } catch (ex) {
        // ignore
      }
      return queryHandler.performQuery(message);
    }
    throw new MessageNotImplementedError(name);
  }
}

MessengerImpl.initialize();
