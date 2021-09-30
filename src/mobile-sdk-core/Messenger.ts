/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { MobileCore } from ".";

/** Type used to listen for queries from native code.
 * @param message: The optional message data received from the native code.
 * @returns A promise containing the optional response to be sent back to the native code.
 */
export declare type QueryListener = (message: any) => Promise<any>;

/**
 * @internal
 */
class QueryContext {
  constructor(public handler: QueryListener | undefined, public scope: any, public once: boolean) { }
}

/** Error subclass that is used when native code sends a query that does not have a handler.
 * @public
 */
export class MessageNotImplementedError extends Error {
  constructor(messageName?: string) {
    super("No handler for " + (messageName ?? "<Unknown>") + " query.");
  }
}

/** Object returned by [[Messenger.onQuery]] to handle a query.
 * @public
 */
export class QueryHandler {
  private _handler?: QueryContext;

  /** Call to set the handler function for this query.
   * @param handler: The handler function for this query.
   * @param scope: The optional scope that acts as "this" for the handler. When using arrow functions, this will normally be undefined.
   * @returns: An arrow function that when called, unsets the handler.
   * @public
   */
  public setHandler(handler: QueryListener, scope?: any): () => void {
    this._handler = new QueryContext(handler, scope, false);
    const event = this;
    return () => { event.unsetHandler(handler, scope); };
  }

  /** Call to set the handler function for this query. It will be automatically unset after the first call.
   * @param handler: The handler function for this query.
   * @param scope: The optional scope that acts as "this" for the handler. When using arrow functions, this will normally be undefined.
   * @returns: An arrow function that when called, unsets the handler.
   * @public
   */
  public setOnce(handler: QueryListener, scope?: any): () => void {
    this._handler = new QueryContext(handler, scope, true);
    const event = this;
    return () => { event.unsetHandler(handler, scope); };
  }

  /** Unset the handler function for this query.
   * @param handler: The handler function to unset.
   * @param scope: The optional scope associated with the handler.
   * @public
   */
  public unsetHandler(handler: QueryListener, scope?: any): boolean {
    if (!this._handler) return false;
    if (this._handler.handler === handler && this._handler.scope === scope) {
      this._handler = undefined;
      return true;
    }
    return false;
  }

  /** Called by [[Messenger]] when a query arrives. Do not call.
   * @internal
   */
  public async performQuery(message: any) {
    if (this._handler) {
      if (this._handler.handler) {
        const result = await this._handler.handler.apply(this._handler.scope, [message]);
        if (this._handler.once) {
          this._handler = undefined;
        }
        return result;
      }
    }
    return null;
  }
}

/** Class for handling communication to and from native code.
 * @public
 */
export class Messenger {
  private static _impl: any;
  public static queryHandlers: { [name: string]: QueryHandler } = {};

  /** Must be called during application startup before any messages are sent in either direction. */
  public static async initialize() {
    if (Messenger._impl === undefined && (MobileCore.isIosPlatform || MobileCore.isAndroidPlatform)) {
      Messenger._impl = await import("./MessengerImpl");
    }
  }

  /** Send a query to native code an return its response.
   * @param name: The name of the query.
   * @param message: Optional message data to send in the query. This cannot use types that are not supported by
   *                 the current platform's JavaScript<->Native communications mechanism. (For example, Date objects
   *                 probably won't work, and must be first converted to strings.)
   * @returns The response from the native code, if any.
   * @public
   */
  public static async query(name: string, message?: any) {
    if (Messenger._impl) {
      return Messenger._impl.MessengerImpl.query(name, message);
    }
    return undefined;
  }

  /** Wrapper around [[query]] that is not async and does not return a result. Use when a query does not have
   * a meaningful result and you don't want to wait for it to complete.
   * @param name: The name of the message to send.
   * @param message: Optional data to send with the message. This data must be made up of types that can be communicated
   *                 to native code using the platform's mechanism. So, for example, it cannot include a function, or a
   *                 JavaScript Date object.
   * @public
   */
  public static sendMessage(name: string, message?: any) {
    // tslint:disable-next-line: no-floating-promises
    Messenger.query(name, message);
  }

  /** Get the QueryHandler for the given query.
   * @param messageName: The name of the query being handled.
   * @returns Unique QueryHandler object for the given query.
   */
  public static onQuery(messageName: string): QueryHandler {
    let query = Messenger.queryHandlers[messageName];
    if (!query) {
      Messenger.queryHandlers[messageName] = new QueryHandler();
      query = Messenger.queryHandlers[messageName];
    }
    return query;
  }
}
