/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { MessengerImpl } from "./common/MessengerImpl";
import { QueryHandler } from "./common/QueryHandler";
import { MobileCore } from "./MobileCore";
import { FrontendQueryTransport } from "./FrontendQueryTransport";

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

