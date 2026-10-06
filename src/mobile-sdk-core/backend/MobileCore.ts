/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Localization } from "@itwin/core-common";
import { LocalizationProvider } from "../common/LocalizationProvider";
import { Messenger } from "./Messenger";

/**
 * Class for top-level MobileCore functionality.
 * @public
 */
export class MobileCore {
  /**
   * @internal
   */
  private static _isInitialized = false;

  /**
   * Initializes the MobileCore module.
   * @param localization - optional localization for localizing error messages. If not specified, error messages will not be localized.
   */
  public static async initialize(localization?: Localization): Promise<void> {
    if (localization) {
      await LocalizationProvider.initialize(localization);
    }
    await Messenger.initialize();
    this._isInitialized = true;
  }

  /**
   * Checks if MobileCore is initialized.
   * @returns true if MobileCore is initialized, or false otherwise.
   * @public
   */
  public static get isInitialized() {
    return this._isInitialized;
  }
}
