/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Base64Converter } from "./Base64Converter";
import { MessageJsonError, MessageNotImplementedError, Messenger, QueryHandler } from "./Messenger";
import { UIError } from "./UIError";

// MessengerImpl implementation that works with iOS and Android.
// Note: Incoming data from native side is BASE64-encoded UTF-8. For any data that is
// pure ASCII, JavaScript's builtin atob() function would decode it. However, any
// data that includes non-ASCII would not decode properly via atob(), so
// Base64Converter.base64Utf8ToString() is used instead.

/**
 * @internal
 */
export class MessengerImpl {
  /**
   * @internal
   */
  private static _anyWindow: any = window;
  /**
   * @internal
   */
  private static _queryId = 0;
  /**
   * @internal
   */
  private static _queryResponse: (responseJson: string) => void;
  /**
   * @internal
   */
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
    const responseName = `Bentley_ITMMessenger_QueryResponse${MessengerImpl._queryId}`;
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
      if (!parsedMessage) {
        return undefined;
      }
      if (parsedMessage.unhandled) {
        throw new MessageNotImplementedError(name);
      } else if (parsedMessage.error !== undefined) {
        const error = parsedMessage.error;
        if (typeof error === "string") {
          throw new Error(parsedMessage.error);
        } else {
          throw new MessageJsonError(JSON.stringify(error));
        }
      }
      return parsedMessage.response;
    }
  }

  /**
   * @internal
   */
  private static async receiveQuery(name: string, messageJson: string) {
    const queryHandler: QueryHandler = Messenger.queryHandlers[name];
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
