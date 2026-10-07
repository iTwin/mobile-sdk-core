/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { LocalizationProvider } from "./LocalizationProvider";
import { MessageNotImplementedError } from "./MessengerErrors";
import { QueryHandler } from "./QueryHandler";

/**
* @internal
*/
export interface QueryResponse {
  data?: any;
  error?: any;
  isUnhandled?: boolean;
}

/**
 * @internal
 */
export type TransportQueryHandler = (name: string, message: string) => Promise<any>;

/**
* @internal
*/
export abstract class QueryTransport {
  protected _onQueryReceived: TransportQueryHandler;
  
  constructor(onQueryReceived: TransportQueryHandler) {
    this._onQueryReceived = onQueryReceived;
  }
  
  public abstract sendQuery(name: string, id: number, message: any): Promise<QueryResponse>;
}

/**
 * @internal
 */
export class MessageJsonError extends Error {
  public json: string;

  constructor(json: string, message?: string) {
    if (message !== undefined) {
      super(message);
    } else if (LocalizationProvider.isInitialized) {
      super(LocalizationProvider.translate("messenger.json-error", { json }));
    } else {
      super(`Messenger JSON error: ${json}.`);
    }
    this.json = json;
  }
}

/**
* @internal
*/
export class MessengerImpl {
  /**
   * @internal
   */
  public queryHandlers: { [name: string]: QueryHandler } = {};

  /**
   * @internal
   */
  private _transport: QueryTransport | undefined;

  /**
   * @internal
   */
  private _queryId = 0;
  
  public initialize(transportFactory: (onQueryReceived: TransportQueryHandler) => QueryTransport) {
    this._transport = transportFactory(async (name: string, message: string) => this.receiveQuery(name, message));
  }
  
  public get isInitialized(): boolean {
    return this._transport !== undefined;
  }
  
  public async query(name: string, message?: any) {
    if (!this._transport) {
      return;
    }
    
    const response = await this._transport.sendQuery(name, this._queryId++, message);
    
    if (response.isUnhandled) {
      throw new MessageNotImplementedError(name);
    }
    
    if (response.error !== undefined) {
      const error = response.error;
      if (typeof error === "string") {
        throw new Error(error);
      } else {
        throw new MessageJsonError(JSON.stringify(error));
      }
    }
    
    return response.data;
  }
  
  public getOrAddQueryHandler(messageName: string): QueryHandler {
    let handler = this.queryHandlers[messageName];
    if (!handler) {
      this.queryHandlers[messageName] = new QueryHandler();
      handler = this.queryHandlers[messageName];
    }
    return handler;
  }
  
  private async receiveQuery(name: string, messageJson: string): Promise<any> {
    const queryHandler: QueryHandler = this.queryHandlers[name];
    if (!queryHandler) {
      throw new MessageNotImplementedError(name);
    }
    
    let message;
    try {
      message = JSON.parse(messageJson);
    } catch {
      // ignore
    }
    return queryHandler.performQuery(message);
  }
}
