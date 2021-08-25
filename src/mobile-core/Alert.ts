/*---------------------------------------------------------------------------------------------
* Copyright (c) 2021 Bentley Systems, Incorporated. All rights reserved.
*--------------------------------------------------------------------------------------------*/
import { ActionStyle, AlertAction, Messenger } from ".";

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
 * @returns The name of the action selected by the user.
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
  return Messenger.query("Bentley_ITM_presentAlert", messageData);
}
