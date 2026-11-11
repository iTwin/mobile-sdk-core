/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/**
 * Type used to listen for queries from native code.
 * @param message The optional message data received from the native code.
 * @returns A promise containing the optional response to be sent back to the native code.
 */
export declare type QueryListener = (message: any) => Promise<any>;

/**
 * @internal
 */
class QueryContext {
  constructor(public handler: QueryListener | undefined, public scope: any, public once: boolean) { }
}

/**
 * Class that allows configuring handling of queries received by the Messenger.
 * @public
 */
export class QueryHandler {
  /**
   * @internal
   */
  private _handler?: QueryContext;

  /**
   * Call to set the handler function for this query.
   * @param handler The handler function for this query.
   * @param scope The optional scope that acts as "this" for the handler. When using arrow functions, this will normally be undefined.
   * @returns: An arrow function that when called, unsets the handler.
   * @public
   */
  public setHandler(handler: QueryListener, scope?: any): () => void {
    this._handler = new QueryContext(handler, scope, false);
    const event = this; // eslint-disable-line @typescript-eslint/no-this-alias
    return () => event.unsetHandler(handler, scope);
  }

  /**
   * Call to set the handler function for this query. It will be automatically unset after the first call.
   * @param handler The handler function for this query.
   * @param scope The optional scope that acts as "this" for the handler. When using arrow functions, this will normally be undefined.
   * @returns: An arrow function that when called, unsets the handler.
   * @public
   */
  public setOnce(handler: QueryListener, scope?: any): () => void {
    this._handler = new QueryContext(handler, scope, true);
    const event = this; // eslint-disable-line @typescript-eslint/no-this-alias
    return () => event.unsetHandler(handler, scope);
  }

  /**
   * Unset the handler function for this query.
   * @param handler The handler function to unset.
   * @param scope The optional scope associated with the handler.
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

  /**
   * Called by {@link Messenger} when a query arrives. Do not call.
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
