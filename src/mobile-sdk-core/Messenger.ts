/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Base64Converter } from "./Base64Converter";
import { MessengerImpl, QueryResponse, QueryTransport, TransportQueryHandler } from "./common/MessengerImpl";
import { QueryHandler } from "./common/QueryHandler";
import { UIError } from "./common/UIError";
import { MobileCore } from "./MobileCore";

/**
 * Class for handling communication to and from native code.
 * @public
 */
export class Messenger {
  /**
   * @internal
   */
  private static _impl = new MessengerImpl();

  /** Gets all query handlers currently registered with this messenger. */
  public static get queryHandlers(): { [name: string]: QueryHandler } {
    return Messenger._impl.queryHandlers;
  }

  /** Sets query handlers currently registered with this messenger. */
  public static set queryHandlers(handlers: { [name: string]: QueryHandler }) {
    Messenger._impl.queryHandlers = handlers;
  }

  /** Must be called during application startup before any messages are sent in either direction. */
  public static async initialize() {
    if (!Messenger._impl.isInitialized && (MobileCore.isIosPlatform || MobileCore.isAndroidPlatform)) {
      Messenger._impl.initialize((onQueryReceivedCallback) => new FrontendQueryTransport(onQueryReceivedCallback));
    }
  }

  /**
   * Send a query to native code and return its response.
   * @param name The name of the query.
   * @param message Optional message data to send in the query. This cannot use types that are not supported by
   *                the current platform's JavaScript<->Native communications mechanism. (For example, Date objects
   *                probably won't work, and must be first converted to strings.)
   * @returns The response from the native code, if any.
   * @public
   */
  public static async query(name: string, message?: any) {
    return Messenger._impl.query(name, message);
  }

  /**
   * Wrapper around {@link Messenger.query} that is not async and does not return a result. Use when a query does not have
   * a meaningful result and you don't want to wait for it to complete.
   * @param name The name of the message to send.
   * @param message Optional data to send with the message. This data must be made up of types that can be communicated
   *                to native code using the platform's mechanism. So, for example, it cannot include a function, or a
   *                JavaScript Date object.
   * @public
   */
  public static sendMessage(name: string, message?: any) {
    void Messenger.query(name, message);
  }

  /**
   * Get the QueryHandler for the given query.
   * @param messageName The name of the query being handled.
   * @returns Unique QueryHandler object for the given query.
   */
  public static onQuery(messageName: string): QueryHandler {
    return Messenger._impl.getOrAddQueryHandler(messageName);
  }
}

/**
 * Query transport that passes messages to and from native UI via iOS and Android webviews.
 *
 * Note: Incoming data from native side is BASE64-encoded UTF-8. For any data that is
 * pure ASCII, JavaScript's builtin atob() function would decode it. However, any
 * data that includes non-ASCII would not decode properly via atob(), so
 * Base64Converter.base64Utf8ToString() is used instead.
 * @internal
 */
class FrontendQueryTransport extends QueryTransport {
  /**
   * @internal
   */
  private _anyWindow: any = window;
  /**
   * @internal
   */
  private _queryResponse: (responseJson: string) => void;
  /**
   * @internal
   */
  private _query: (messageJson: string) => void;

  constructor(onQueryReceived: TransportQueryHandler) {
    super(onQueryReceived);

    if (this._anyWindow.webkit) {
      // iOS
      this._queryResponse = (responseJson) => this._anyWindow.webkit.messageHandlers.Bentley_ITMMessenger_QueryResponse.postMessage(responseJson);
      this._query = (messageJson) => this._anyWindow.webkit.messageHandlers.Bentley_ITMMessenger_Query.postMessage(messageJson);
    } else if (this._anyWindow.Bentley_ITMMessenger) {
      // Android
      this._queryResponse = (responseJson) => this._anyWindow.Bentley_ITMMessenger.queryResponse(responseJson);
      this._query = (messageJson) => this._anyWindow.Bentley_ITMMessenger.query(messageJson);
    } else {
      throw new Error("This MessengerImpl only supports iOS and Android.");
    }

    this._anyWindow.Bentley_ITMMessenger_Query = this._handleIncomingQuery;
  }

  private _handleIncomingQuery = async (name: string, queryId: number, messageJson: string) => {
    let decodedMessageJson: string | undefined;
    try {
      decodedMessageJson = Base64Converter.base64Utf8ToString(messageJson);
    } catch {
      // ignore
    }

    const responseMessage: any = { queryId };
    try {
      const response = await this._onQueryReceived(name, decodedMessageJson ?? "");
      responseMessage.response = response;
    } catch (error) {
      responseMessage.error = UIError.create(error);
    }
    this._queryResponse(JSON.stringify(responseMessage));
  }

  public async sendQuery(name: string, queryId: number, message: any): Promise<QueryResponse> {
    const responseName = `Bentley_ITMMessenger_QueryResponse${queryId}`;
    const responsePromise = new Promise<string | undefined>((resolve) => {
      this._anyWindow[responseName] = resolve;
    });

    this._query(JSON.stringify({ name, message, queryId }));

    const responseJson = await responsePromise;
    delete this._anyWindow[responseName];

    if (responseJson === undefined)
      return {};

    let response: any;
    try {
      // See note before class.
      response = JSON.parse(Base64Converter.base64Utf8ToString(responseJson));
    } catch {
      // ignore
    }

    if (!response) {
      return {};
    }

    if (response.unhandled) {
      return { isUnhandled: true };
    }

    if (response.error !== undefined) {
      return { error: response.error };
    }

    return { data: response.response };
  }
}
