/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { MobileHost } from "@itwin/core-mobile/lib/cjs/MobileBackend";
import { MessengerImpl, QueryResponse, QueryTransport, TransportQueryHandler } from "../common/MessengerImpl";
import { QueryHandler } from "../common/QueryHandler";
import { UIError } from "../common/UIError";

/**
 * Class for handling communication to and from native code.
 * @public
 */
export class Messenger {
  /**
   * @internal
   */
  private static _impl = new MessengerImpl();

  /** Must be called during application startup before any messages are sent in either direction. */
  public static async initialize() {
    if (!Messenger._impl.isInitialized) {
      Messenger._impl.initialize((onQueryReceivedCallback) => new BackendQueryTransport(onQueryReceivedCallback));
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
 * Query transport that passes messages to and from native UI via mobile native add-on.
 * @internal
 */
class BackendQueryTransport extends QueryTransport {
  constructor(onQueryReceived: TransportQueryHandler) {
    super(onQueryReceived);
    MobileHost.nativeQueryHandler = this._handleIncomingQuery;
  }

  private _handleIncomingQuery = async (name: string, messageJson: string): Promise<string> => {
    try {
      const result = await this._onQueryReceived(name, messageJson);
      return JSON.stringify({ response: result });
    } catch (error) {
      return JSON.stringify({ error: UIError.create(error) });
    }
  }

  public async sendQuery(name: string, _queryId: number, message: any): Promise<QueryResponse> {
    const response = await this.sendQueryToNative(name, JSON.stringify(message) ?? "");

    let responseData: any = response.message;
    try {
      responseData = response.message && JSON.parse(response.message);
    } catch {
      // ignore
    }

    if (response.isError) {
      return { error: responseData };
    }

    if (!responseData) {
      return {};
    }

    if (responseData.unhandled) {
      return { isUnhandled: true };
    }

    if (responseData.error !== undefined) {
      return { error: responseData.error };
    }

    return { data: responseData.response };
  }

  private async sendQueryToNative(name: string, message: string): Promise<{ message?: string, isError: boolean }> {
    return new Promise((resolve) => {
      MobileHost.device.sendQueryToNative(name, message, (response, error) => {
        if (error !== undefined) {
          resolve({ message: error, isError: true });
        } else {
          resolve({ message: response, isError: false });
        }
      });
    });
  }
}
