/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { LocalizationProvider } from "./LocalizationProvider";

/**
 * Error subclass that is used when native code sends a query that does not have a handler.
 * @public
 */
export class MessageNotImplementedError extends Error {
  constructor(messageName?: string) {
    if (LocalizationProvider.isInitialized) {
      const name = messageName ?? LocalizationProvider.translate("messenger.unknown");
      super(LocalizationProvider.translate("messenger.query-not-handled-error", { name }));
    } else {
      const name = messageName ?? "<Unknown>";
      super(`No handler for "${name}" query.`);
    }
  }
}
