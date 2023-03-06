/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Messenger } from "./Messenger";
import { MobileCore } from "./MobileCore";

/**
 * Style used by [[ActionSheetAction]] and [[AlertAction]].
 * @public
 */
export enum ActionStyle {
  Default = "default",
  Cancel = "cancel",
  Destructive = "destructive",
}

/**
 * Action to take in the [[presentAlert]] function or [[ActionSheetButton]] component.
 * @public
 */
export interface AlertAction {
  /** The key for this action, which is then returned by presentAlert if this action is selected: must be unique. */
  name: string;
  /** The text to present to the user for this action. */
  title: string;
  /** The style for this action. Default is [[ActionStyle.Default]]. */
  style?: ActionStyle;
  /** The callback called when this action is selected by the user.
   *
   * It is your choice whether to use this or process the return value from [[processAlert]] or
   * [[ActionSheet.show]]
   */
  onSelected?: (action: AlertAction) => void;
}

/**
 * Actions to take in [[presentAlert]] and [[presentActionSheet]].
 *
 * Note: If you use a function that returns a Promise, it needs to resolve the Promise quickly,
 * since the function does not get called until the user triggers it. Consequently, the user is
 * actively waiting for the Promise resolution.
 * @public
 */
export type AlertActions = AlertAction[] | (() => AlertAction[]) | (() => Promise<AlertAction[]>);

/**
 * Props for the [[presentAlert]] function.
 * @public
 */
export interface AlertProps {
  /** Optional title of the presented alert box. */
  title?: string;
  /**
   * Optional message in the presented alert box.
   *
   * __Note__: On Android, if more than three actions are provided, this is ignored.
   */
  message?: string;
  /**
   * List of actions in the presented alert box. Must contain at least one item.
   *
   * __Note__: On Android, if three or less actions are supplied, they are mapped to the `AlertDialog`
   * buttons as follows:
   * * The last action goes into the positive button of the `AlertDialog`.
   * * The first to last action (if present) goes into the negative button of the `AlertDialog`.
   * * The second to last action (if present) goes into the neutral button of the `AlertDialog`.
   */
  actions: AlertActions;
  /** Whether or not to show the status bar during the alert, default is false. */
  showStatusBar?: boolean;
}

/**
 * Takes an object of type AlertActions, which may either be an array of AlertAction objects or
 * a function that returns an array of AlertAction objects, and returns the actual array of
 * AlertAction objects.
 *
 * Note: The function may be synchronous or asynchronous.
 * @param alertActions The AlertActions object that may need to be extracted.
 * @returns The array of AlertAction objects.
 */
export async function extractAlertActions(alertActions: AlertActions) {
  if (typeof alertActions === "function") {
    return alertActions();
  } else {
    return alertActions;
  }
}

/**
 * Function to present an alert box to the user with a set of possible actions they can take.
 * No more than 3 actions are allowed on Android (4 if one has a style of Cancel).
 *
 * Note: While this does use a native alert box like window.alert() and window.confirm(), it does not pause JavaScript
 * execution in the web view. It does, however, prevent all user interaction outside the alert box.
 * @returns The name of the action selected by the user. If you set the onSelected callback for
 *          each [[AlertAction]], you can ignore the return value. If a presentAlert() is called when a previous
 *          alert is still waiting for a response, this returns undefined.
 * @public
 */
export async function presentAlert(props: AlertProps): Promise<string | undefined> {
  const { title, message, showStatusBar, actions: propsActions } = props;
  const actions = await extractAlertActions(propsActions);
  const messageData = {
    title,
    message,
    showStatusBar,
    actions: [...actions],
  };
  for (const action of messageData.actions) {
    if (!action.style) {
      action.style = ActionStyle.Default;
    }
  }
  const result: string | undefined = (await Messenger.query("Bentley_ITM_presentAlert", messageData)) ?? undefined;
  callOnSelected(result, actions);
  return result;
}

/**
 * Call the onSelected callback on the action whose name matches [[selectedActionName]].
 *
 * If onSelected is undefined for the action with the matching name, this function does nothing.
 *
 * Note: this is used internally by [[presentActionSheet]] and [[presentAlert]].
 * @param selectedActionName The name of the action selected by the user.
 * @param actions The list of actions presented to the user.
 */
export function callOnSelected(selectedActionName: string | undefined, actions: AlertAction[]) {
  if (selectedActionName === undefined) return;
  for (const action of actions) {
    if (action.name === selectedActionName) {
      action.onSelected?.(action);
      return;
    }
  }
}

async function presentConfirmationAlert(title: string, message: string, isYesNo: boolean, destructiveChoice: boolean | undefined = undefined) {
  return (await presentAlert({
    title,
    message,
    actions: [{
      name: "yes",
      title: MobileCore.translate(isYesNo ? "general.yes" : "general.ok"),
      style: destructiveChoice ? ActionStyle.Destructive : ActionStyle.Default,
    },
    {
      name: "no",
      title: MobileCore.translate(isYesNo ? "general.no" : "general.cancel"),
      style: destructiveChoice === false ? ActionStyle.Destructive : ActionStyle.Default,
    }],
  })) === "yes";
}

/**
 * Presents an alert box with "Yes" and "No" buttons.
 * @param title The title to use for the alert.
 * @param message The message to show in the alert.
 * @param destructiveChoice If true, "Yes" choice is destructive, if false, "No" choice is destructive,
 *                          if undefined, neither choice is destructive, default is undefined.
 * @returns true if the user selects "Yes", or false otherwise.
 */
export async function presentYesNoAlert(title: string, message: string, destructiveChoice: boolean | undefined = undefined) {
  return presentConfirmationAlert(title, message, true, destructiveChoice);
}

/**
 * Presents an alert box with "OK" and "Cancel" buttons.
 * @param title The title to use for the alert.
 * @param message The message to show in the alert.
 * @param destructiveChoice If true, "OK" choice is destructive, if false, "Cancel" choice is destructive,
 *                          if undefined, neither choice is destructive, default is undefined.
 * @returns true if the user selects "OK", or false otherwise.
 */
export async function presentOkCancelAlert(title: string, message: string, destructiveChoice: boolean | undefined = undefined) {
  return presentConfirmationAlert(title, message, false, destructiveChoice);
}
