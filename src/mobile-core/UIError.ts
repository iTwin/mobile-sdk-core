/*---------------------------------------------------------------------------------------------
* Copyright (c) 2021 Bentley Systems, Incorporated. All rights reserved.
*--------------------------------------------------------------------------------------------*/
import { ResponseError } from "@bentley/itwin-client";
import { MessageNotImplementedError, MobileCore } from ".";

/** Base class for showing a user friendly error.
 * For common errors, provide utility creation methods in UIError.
 * @public
 */
export class UserFriendlyError extends Error {
}

/** Class for showing errors to the end user.
 * @public
 */
export class UIError {
  [key: string]: any;
  public constructor() { }
  public static create: (error: any) => UIError = (error) => UIError.create(error);

  public static i18n(key: string): string {
    return MobileCore.translate("ui-error." + key);
  }

  /** Creates an error for use when the internet is unreachable.
   * @returns A UserFriendlyError with a localized internet unreachable message.
   * @public
   */
  public static internetUnreachableError(): UserFriendlyError {
    return new UserFriendlyError(this.i18n("internet-unreachable"));
  }

  /** Create a UIError object from the error that is caught in an exception handler.
   * Note that this has logic detecting various error information in the given error, and creating an
   * appropriate UIError.
   * @param error: The error to convert into a UIError
   * @returns A UIError representing the given error.
   */
  public static defaultCreate(error: any): UIError {
    if (error instanceof UIError) {
      return error;
    }
    const uiError = new UIError();
    if (error instanceof UserFriendlyError) {
      uiError.Message = error.message;
    } else if (error instanceof Error) {
      uiError.Description = error.message;
      if (error instanceof MessageNotImplementedError) {
        uiError.MessageNotImplemented = true;
      }
      if (error instanceof ResponseError &&
        error.hasOwnProperty("_data")) {
        const errorData = (error as any)._data;
        if (errorData.hasOwnProperty("errorId"))
          uiError.errorId = errorData.errorId;
        if (errorData.hasOwnProperty("errorMessage"))
          uiError.Description = errorData.errorMessage;
      }
      uiError.Stack = error.stack;
      const anyError: any = error;
      uiError.Line = anyError.line;
      uiError.Column = anyError.column;
    } else if (typeof error === "string") {
      uiError.Description = error;
    } else {
      for (const fieldName in error) {
        if (error.hasOwnProperty(fieldName)) {
          uiError[fieldName] = error[fieldName];
        }
      }
    }
    return uiError;
  }
}
