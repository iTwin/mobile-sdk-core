/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Messenger } from "./Messenger";

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
 * Actions to take in the [[presentAlert]] function.
 * @public
 */
export type AlertActions = AlertAction[] | (() => AlertAction[]);

/**
 * Props for the [[presentAlert]] function.
 * @public
 */
export interface AlertProps {
  /** Optional title of the presented alert box. */
  title?: string;
  /** Optional message in the presented alert box. */
  message?: string;
  /** List of actions in the presented alert box. Must contain at least one item. */
  actions: AlertActions;
}

/**
 * Function to present an alert box to the user with a set of possible actions they can take.
 * No more than 3 actions are allowed on Android (4 if one has a style of Cancel).
 *
 * Note: While this does use a native alert box like window.alert() and window.confirm(), it does not pause JavaScript
 * execution in the web view. It does, however, prevent all user interaction outside the alert box.
 * @returns The name of the action selected by the user. If you set the onSelected callback for
 *          each [[AlertAction]], you can ignore the return value.
 * @public
 */
export async function presentAlert(props: AlertProps): Promise<string> {
  const { title, message, actions: propsActions } = props;
  const actions = typeof propsActions === "function" ? propsActions() : propsActions;
  const messageData = {
    title,
    message,
    actions: [...actions],
  };
  for (const action of messageData.actions) {
    if (!action.style) {
      action.style = ActionStyle.Default;
    }
  }
  const result: string = await Messenger.query("Bentley_ITM_presentAlert", messageData);
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
