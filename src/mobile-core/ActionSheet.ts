/*---------------------------------------------------------------------------------------------
* Copyright (c) 2021 Bentley Systems, Incorporated. All rights reserved.
*--------------------------------------------------------------------------------------------*/
import { Messenger, MobileCore } from ".";

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
 * Actions to take in the [[ActionSheetButton]]. Note that the callback-based version allows for the definition of the
 * actions to be delayed until the point that the [[ActionSheetButton]] is pressed, so that if the list of actions
 * changes based on other user activities, they will always be correct when the user presses the button.
 */
export type ActionSheetActions = ActionSheetAction[] | (() => ActionSheetAction[]);

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
}

/**
 * Action to take in the [[ActionSheetButton]] component.
 * Note: this class is going away once ActionSheet.show is changed to directly return the user's selection.
 * @beta
 */
export interface ActionSheetAction extends AlertAction {
  /** Callback called when this action is selected by the user. */
  onSelected: (action: ActionSheetAction) => void;
}

/**
 * @internal
 */
interface AlertControllerActions {
  [name: string]: ActionSheetAction;
}

/** Properties for [[ActionSheet.show]]
 * @beta
 */
export interface ActionSheetProps {
  /** Optional title to show on the action sheet. */
  title?: string;
  /** Optional message to show on the action sheet. */
  message?: string;
  /** Actions to perform by the action sheet.
   * Note: If no action with an ActionStyle of Cancel is present, a default cancel action will be automatically
   * provided unless skipCancel is set to true. Note that iPads allow cancelation even if there is no cancel action,
   * but phones don't. Consequently, not allowing cancel on phones should be extremely rare.
   */
  actions: ActionSheetActions;
  /** If set to true, prevents the default Cancel action from being added, default is false. */
  skipCancel?: boolean;
}

/**
 * Class used to show a native Action Sheet.
 * Note: This API is going to be changed to return the user's selection in the call to show, instead of having each
 * action have a callback.
 * @beta
 */
export class ActionSheet {
  private static _nextSenderId = 0;
  private static _haveListener = false;
  private static _actions: { [key: number]: any } = {};
  private static _waiting: { [key: number]: boolean } = {};

  /**
   * Registers the specified actions with the Messenger system so that when they are triggered, they
   * will be sent to the proper receiver.
   * @param senderId The senderId for the component registering actions.
   * @param actions Actions to register.
   */
  public static registerActions(senderId: number, actions: ActionSheetAction[]) {
    const controllerActions: AlertControllerActions = {};
    for (const action of actions) {
      controllerActions[action.name] = action;
    }
    ActionSheet._actions[senderId] = controllerActions;
  }

  /**
   * Unregisters all actions for the specified sender.
   * @param senderId The senderId for the component unregistering actions.
   */
  public static unregisterActions(senderId: number) {
    delete this._actions[senderId];
  }

  /**
   * The next available senderId for sending actions. Call this once for each instance of a component, and then
   * use the value.
   */
  public static get nextSenderId() {
    this.initListener();
    return ++this._nextSenderId;
  }

  private static initListener() {
    if (this._haveListener) return;
    // Note: one global (static member variable) handler for actionSheetAction.
    Messenger.onQuery("Bentley_ITM_actionSheetAction").setHandler(this._onActionSheetAction);
    this._haveListener = true;
  }

  private static _onActionSheetAction = async (args: { senderId: number, name: number }) => {
    const { senderId, name } = args;
    const actions = ActionSheet._actions[senderId];
    if (!actions) return;
    const action = actions[name];
    if (!action) return;
    action.onSelected(action);
    ActionSheet.unregisterActions(senderId);
  }

  /**
   * Show a native action sheet.
   * Note: This function is going to change to directly return the user's selection, instead of having a callback
   * in each action.
   * @param props The properties of the action sheet.
   * @param sourceRect The bounding rectangle of the control that is showing the action sheet.
   * @param senderId The optional sender ID to use for messaging. If undefined, this will be auto-generated.
   * @beta
   */
  public static show = async (props: ActionSheetProps, sourceRect: DOMRect, senderId?: number) => {
    if (senderId === undefined) {
      senderId = ActionSheet.nextSenderId;
    }
    const waiting = ActionSheet._waiting[senderId] ?? false;
    // Ignore clicks while we are waiting for a previous one to be processed.
    if (waiting) {
      return;
    }
    ActionSheet._waiting[senderId] = true;
    const { message, title, actions: propsActions, skipCancel = false } = props;
    const actions = typeof propsActions === "function" ? propsActions() : propsActions;
    ActionSheet.registerActions(senderId, actions);
    const messageData = {
      senderId,
      title,
      message,
      style: "actionSheet",
      sourceRect,
      actions: [...actions],
    };
    let needCancel = !skipCancel;
    for (const action of messageData.actions) {
      if (!action.style) {
        action.style = ActionStyle.Default;
      } else if (action.style === ActionStyle.Cancel) {
        needCancel = false;
      }
    }
    if (needCancel) {
      messageData.actions.push({
        name: "itm_cancel",
        title: MobileCore.translate("general.cancel"),
        style: ActionStyle.Cancel,
        onSelected: () => { },
      });
    }
    await Messenger.query("Bentley_ITM_presentActionSheet", messageData);
    ActionSheet._waiting[senderId] = false;
  }
}
