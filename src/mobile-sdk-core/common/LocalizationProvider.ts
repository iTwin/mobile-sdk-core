/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Localization } from "@itwin/core-common";

/**
 * @internal
 */
export class LocalizationProvider {
  /**
   * @internal
   */
  private static _localization: Localization;

  /**
   * @internal
   */
  private static _isInitialized = false;

  public static async initialize(localization: Localization) {
    LocalizationProvider._localization = localization;
    await localization.registerNamespace("iTwinMobileCore");
    LocalizationProvider._isInitialized = true;
  }

  public static get isInitialized() {
    return LocalizationProvider._isInitialized;
  }

  public static translate(key: string, options?: any) {
    if (LocalizationProvider._localization === undefined) {
      return `Attempt to translate ${key} before localization init.`;
    }
    return LocalizationProvider._localization.getLocalizedString(`iTwinMobileCore:${key}`, options);
  }
}
