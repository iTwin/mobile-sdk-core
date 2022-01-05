/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BeUiEvent } from "@itwin/core-bentley";
import { LocalBriefcaseProps, Localization } from "@itwin/core-common";
import { EmphasizeElements, IModelApp, NativeApp, ScreenViewport } from "@itwin/core-frontend";
import { Messenger } from "./Messenger";
import "./Geolocation"; // Just importing this activates the Polyfill.
import "./MobileCore.scss";

/** The internet reachability status.
 * @public
 */
export enum ReachabilityStatus {
  /** The internet is not currently reachable. */
  NotReachable = 0,
  /** The internet is currently reachable via WiFi (or other unmetered connection). */
  ReachableViaWiFi,
  /** The internet is currently reachable via a cellular connection. */
  ReachableViaWWAN,
}

/**
 * @internal
 */
declare global {
  interface Window {
    Bentley_InternetReachabilityStatus?: ReachabilityStatus; // eslint-disable-line @typescript-eslint/naming-convention
  }
}

/** Makes one or more properties optional for the given type. */
export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

/** Interface for BeUiEvents posted about software keyboard showing and hiding. */
export interface KeyboardEventArgs {
  /** The animation duration for the software keyboard hiding or showing. */
  duration: number;
  /** The height of the software keyboard. */
  height: number;
}

/** Interface for BeUiEvents posted about CSS variable changes made by [[MobileCore.setCssVariable]] and
 * [[MobileCore.setCssVariables]].
 */
export interface CssVariableEventArgs {
  /** Set containing the names of the variables whose values have changed. */
  names: Set<string>;
  /** The HTMLElement containing the change variables, where undefined means document.documentElement. */
  htmlElement: HTMLElement | undefined;
}

interface UpdateSafeAreaArgs {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Class for top-level MobileCore functionality. */
export class MobileCore {
  private static _localization: Localization;
  private static _isKeyboardVisible = false;
  private static _urlSearchParams: URLSearchParams | undefined;
  private static _isInitialized = false;

  /** BeUiEvent emitted right before the software keyboard is shown. */
  public static onKeyboardWillShow = new BeUiEvent<KeyboardEventArgs>();
  /** BeUiEvent emitted right after the software keyboard is shown. */
  public static onKeyboardDidShow = new BeUiEvent<KeyboardEventArgs>();
  /** BeUiEvent emitted right before the software keyboard is hidden. */
  public static onKeyboardWillHide = new BeUiEvent<KeyboardEventArgs>();
  /** BeUiEvent emitted right after the software keyboard is hidden. */
  public static onKeyboardDidHide = new BeUiEvent<KeyboardEventArgs>();
  /** BeUiEvent emitted when [[MobileCore.setCssVariable]] or [[MobileCore.setCssVariables]] are used to change CSS variable
   * values.
   */
  public static onCssVariableDidChange = new BeUiEvent<CssVariableEventArgs>();

  /** Translate a string from the MobileCore i18n namespace.
   * @param - The key for the string to translate. For example, "general.cancel".
   * @param - Optional options to pass into the i18next system.key
   * @returns The translated string, or key if it is not found.
   */
  public static translate(key: string, options?: any) {
    if (this._localization === undefined) {
      return `Attempt to translate ${key} before localization init.`;
    }
    const result = this._localization.getLocalizedStringWithNamespace("iTwinMobileCore", key, options);
    return result;
  }

  /** Property indicating if the software keyboard is currently visible. */
  public static get isKeyboardVisible() {
    return this._isKeyboardVisible;
  }

  /** Initializes the MobileCore module.
   * @param localization - The [[Localization]] object (from iModelJs).
   */
  public static async initialize(localization: Localization): Promise<void> {
    this._localization = localization;
    await localization.registerNamespace("iTwinMobileCore");
    await Messenger.initialize();
    Messenger.onQuery("keyboardWillShow").setHandler(MobileCore._keyboardWillShow);
    Messenger.onQuery("keyboardDidShow").setHandler(MobileCore._keyboardDidShow);
    Messenger.onQuery("keyboardWillHide").setHandler(MobileCore._keyboardWillHide);
    Messenger.onQuery("keyboardDidHide").setHandler(MobileCore._keyboardDidHide);
    Messenger.onQuery("muiUpdateSafeAreas").setHandler(MobileCore._muiUpdateSafeAreas);
    this._isInitialized = true;
  }

  /** Checks if MobileCore is initialized.
   * @returns true if MobileCore is initialized, or fals otherwise.
   * @public
   */
  public static get isInitialized() {
    return this._isInitialized;
  }

  /** Sets a CSS variable and emits [[MobileCore.onCssVariableDidChange]] to indicate the change.
   * @param name - The name of the CSS variable to set. (Must begin with "--".)
   * @param value - The new value for the CSS variable.
   * @param htmlElement - The HTMLElement in which to set the CSS variable, defaults to document.documentElement.
   */
  public static setCssVariable(name: string, value: string, htmlElement?: HTMLElement) {
    (htmlElement ?? document.documentElement).style.setProperty(name, value);
    this.onCssVariableDidChange.emit({ names: new Set<string>([name]), htmlElement });
  }

  /** Sets multiple CSS variable and emit [[MobileCore.onCssVariableDidChange]] to indicate the changes.
   * @param variables - Array containing variable names and values to set. (Each name must begin with "--".)
   * @param htmlElement - The HTMLElement in which to set the CSS variables, defaults to document.documentElement.
   */
  public static setCssVariables(variables: Array<{ name: string, value: string }>, htmlElement?: HTMLElement) {
    const names = new Set<string>();
    for (const { name, value } of variables) {
      (htmlElement ?? document.documentElement).style.setProperty(name, value);
      names.add(name);
    }
    this.onCssVariableDidChange.emit({ names, htmlElement });
  }

  /** Checks if the internet is currently reachable.
   * @returns true if the internet is reachable, or false otherwise.
   * @public
   */
  public static get isInternetReachable() {
    return this.internetReachabilityStatus !== ReachabilityStatus.NotReachable;
  }

  /** Gets the current internet reachability status.
   * @returns The current internet reachability status.
   * @public
   */
  public static get internetReachabilityStatus(): ReachabilityStatus {
    if (window.Bentley_InternetReachabilityStatus === undefined) {
      return ReachabilityStatus.NotReachable;
    }
    return window.Bentley_InternetReachabilityStatus;
  }

  /**
   * @internal
   */
  private static get urlSearchParams(): URLSearchParams {
    if (this._urlSearchParams === undefined) {
      const hash = new URL(document.URL).hash;
      this._urlSearchParams = new URLSearchParams(hash.substr(1));
    }
    return this._urlSearchParams;
  }

  public static getUrlSearchParam(name: string) {
    const searchParams = this.urlSearchParams;
    const value = searchParams.get(name);
    if (value !== null) {
      return value;
    }
    return undefined;
  }

  /** Gets the name of the platform value in the current URL's hash parameters.
   * @returns The platform value from the current URL's hash parameters, or "unknown" if there is no platform value.
   * @public
   */
  public static getPlatform() {
    return this.getUrlSearchParam("platform") ?? "unknown";
  }

  /** Check to see if the current platform is iOS.
   * @returns true if the current platform is iOS (or iPadOS), false otherwise.
   * @public
   */
  public static get isIosPlatform() {
    return this.getPlatform() === "ios";
  }

  /** Check to see if the current platform is Android.
   * @returns true if the current platform is Android, false otherwise.
   * @public
   */
  public static get isAndroidPlatform() {
    return this.getPlatform() === "android";
  }

  /** Returns a date no less than [[min]] and no greater than [[max]].
   * @param value - The date to clamp.
   * @param min - The optional minimum date. If this is undefined, there is no minimum date.
   * @param max - The optional maximum date. If this is undefined, there is no maximum date.
   * @returns [[value]], clamped to be between [[min]] and [[max]].
   * @public
   */
  public static clampedDate(value: Date, min?: Date, max?: Date) {
    if (min && value.getTime() < min.getTime()) {
      return new Date(min);
    }
    if (max && value.getTime() > max.getTime()) {
      return new Date(max);
    }
    return new Date(value);
  }

  /** Delete all files associated with the specified cached briefcase.
   * @param briefcase The cached briefcase to delete.
   * @public
   */
  public static async deleteCachedBriefcase(briefcase: LocalBriefcaseProps) {
    await NativeApp.deleteBriefcase(briefcase.fileName);
  }

  /** Delete all cached briefcases for the specified project, or all cached briefcases for all projects
   * if a project is not specified.
   * @param projectId If set, the projectId of the project from which to delete all cached briefcases.
   *                  If unset, cached briefcases from all projects will be deleted.
   * @public
   */
  public static async deleteCachedBriefcases(projectId?: string) {
    const briefcases = await NativeApp.getCachedBriefcases();
    for (const briefcase of briefcases) {
      if (!projectId || projectId === briefcase.iTwinId) {
        await NativeApp.deleteBriefcase(briefcase.fileName);
      }
    }
  }

  /** Utility function to sleep for the specified number of milliseconds.
   *
   * @param ms Number of milliseconds to sleep.
   * @returns A promise that fulfills after [[ms]] milliseconds.
   */
  public static async sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private static _keyboardWillShow = async (args: KeyboardEventArgs) => {
    // Anything tracking the keyboard height probably has --mui-safe-area-bottom already included in its bottom margin
    // or padding, so subtract the size of the bottom safe area from the effective keyboard height.
    const effectiveHeight = args.height - getCssVariableAsNumber("--mui-safe-area-bottom");
    MobileCore.setCssVariables([
      { name: "--mui-keyboard-height", value: `${args.height}px` },
      { name: "--mui-keyboard-effective-height", value: `${effectiveHeight}px` },
      { name: "--mui-keyboard-animation-duration", value: `${args.duration}s` },
      // When the software keyboard is visible, the bottom of the usable screen has no safe area.
      { name: "--mui-safe-area-bottom-over-keyboard", value: "0px" },
    ]);
    MobileCore.onKeyboardWillShow.emit(args);
  };

  private static _keyboardDidShow = async (args: KeyboardEventArgs) => {
    MobileCore._isKeyboardVisible = true;
    MobileCore.onKeyboardDidShow.emit(args);
  };

  private static _keyboardWillHide = async (args: KeyboardEventArgs) => {
    MobileCore.setCssVariables([
      { name: "--mui-keyboard-height", value: "0px" },
      { name: "--mui-keyboard-effective-height", value: "0px" },
      { name: "--mui-keyboard-animation-duration", value: `${args.duration}s` },
      // When the software keyboard is not visible, the bottom of the visible screen can have a safe area.
      { name: "--mui-safe-area-bottom-over-keyboard", value: "var(--mui-safe-area-bottom)" },
    ]);
    MobileCore.onKeyboardWillHide.emit(args);
  };

  private static _keyboardDidHide = async (args: KeyboardEventArgs) => {
    MobileCore._isKeyboardVisible = false;
    MobileCore.onKeyboardDidHide.emit(args);

    // Ensure the UI is scrolled to the top after the keyboard closes.
    // This does not seem to happen automatically on an iPHone 7 using iOS 13.3.
    document.documentElement.scrollTop = 0;
  };

  private static _muiUpdateSafeAreas = async (args: UpdateSafeAreaArgs) => {
    const root = document.documentElement;
    for (const sideName in args) {
      if (args.hasOwnProperty(sideName)) {
        const key = `--mui-safe-area-${sideName}`;
        const value = `${((args as any)[sideName]).toString()}px`;
        root.style.setProperty(key, value);
      }
    }
  };
}

/**
 * Screen edge for use with [[getSafeAreaInset]].
 * @public
 */
export enum ScreenEdge {
  Top = "top",
  Left = "left",
  Bottom = "bottom",
  Right = "right",
}

/** Returns the value of the given CSS variable as a number, or the given default value if the variable does not exist
 * or is not a number.
 * @param variable - The name of the CSS variable to read.
 * @param defaultValue - The default value to use if the variable does not exist or is not a number.
 * @returns The numeric value of the CSS variable, or [[defaultValue]].
 * @public
 */
export function getCssVariableAsNumberOrDefault(variable: string, defaultValue = 0): number {
  const value = getCssVariableAsNumber(variable);
  if (isNaN(value)) return defaultValue;
  return value;
}

/** Returns the size of the safe area for the specified screen edge.
 * @param edge - The edge of the screen to get the safe area for.
 * @returns The size of the safe area on the specified screen edge.
 */
export function getSafeAreaInset(edge: ScreenEdge) {
  const variableName = `--mui-safe-area-${edge}`;
  const sai = parseInt(getComputedStyle(document.documentElement).getPropertyValue(variableName).trim(), 10);
  return isNaN(sai) ? 0 : sai;
}

/** Returns the input object without the given key.
 * @param props - The input object.
 * @param keyName - The key to omit from the returned object.
 * @returns A copy of the input object without the key.
 */
export function withoutProperty(props: any, keyName: string) {
  const { [keyName]: removed, ...rest } = props; // eslint-disable-line @typescript-eslint/no-unused-vars
  return rest;
}

/** Returns the input object without the "className" key.
 * @param props - The input object.
 * @returns A copy of the input object without the "className" key.
 */
export function withoutClassName(props: any) {
  return withoutProperty(props, "className");
}

/** Convenience class for a [[BeUiEvent]] without any parameters */
export class NullBeUiEvent extends BeUiEvent<null> {
  public override emit() {
    super.emit(null);
  }
}

/** Here for backwards compatibility; use NullBeUiEvent in new code. */
export type NullUiEvent = NullBeUiEvent;

/** Delays the emit with a setTimeout call to allow for any new state to settle. */
export class ReloadedEvent extends NullBeUiEvent {
  public override emit() {
    setTimeout(() => super.emit(), 0);
  }
}

/**
 * Function to get the currently active EmphasizeElements and ScreenViewport.
 * @returns A tuple consisting of either an EmphasizeElements and a ScreenViewport or two undefined values.
 */
export function getEmphasizeElements(): [ScreenViewport | undefined, EmphasizeElements | undefined] {
  const vp = IModelApp.viewManager.getFirstOpenView();
  if (!vp) return [undefined, undefined];
  const ee = EmphasizeElements.getOrCreate(vp);
  return [vp, ee];
}

/**
 * Function to get all viewports.
 * @returns An array consisting of all viewports registered with [[IModelApp.viewManager]].
 */
export function getAllViewports() {
  return [...IModelApp.viewManager];
}

const anyWindow: any = window;

if (anyWindow.Bentley_FinishLaunching === undefined) {
  anyWindow.Bentley_FinishLaunching = () => {};
}

// NOTE: getCssVariable and getCssVariableAsNumber were copied here from:
// https://github.com/iTwin/itwinjs-core/blob/e0a47b42ff521849957a14df863a86252f791487/ui/core-react/src/core-react/utils/getCssVariable.ts
// These two functions were the ONLY dependencies that mobile-sdk-core had on ui-core, and ui-core
// depends on react and react-redux. So, by pulling these in here, we remove those dependencies.

/**
 * Get CSS variable
 * @param variableName The name of the variable in CSS. Typically has "--" prefix.
 * @param htmlElement The DOM node to read the variable value from, or undefined to use document.documentElement.
 * @returns The value of the CSS variable.
 * @public
 */
export function getCssVariable(variableName: string, htmlElement?: HTMLElement): string {
  const element = htmlElement ?? document.documentElement;
  const cssStyles = getComputedStyle(element, null);
  const cssVal = String(cssStyles.getPropertyValue(variableName)).trim();
  return cssVal;
}

/**
 * Get CSS variable as number
 * @param variableName The name of the variable in CSS. Typically has "--" prefix.
 * @param htmlElement The DOM node to read the variable value from, or undefined to use document.documentElement.
 * @returns The value of the CSS variable as a number, NaN if there is a problem reading the value.
 * @public
*/
export function getCssVariableAsNumber(variableName: string, htmlElement?: HTMLElement): number {
  let cssValNum: number = NaN;
  const cssValStr = getCssVariable(variableName, htmlElement);
  if (cssValStr)
    cssValNum = parseFloat(cssValStr);
  return cssValNum;
}
