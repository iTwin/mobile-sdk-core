/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ActionStyle, AlertActions, callOnSelected, extractAlertActions } from "./Alert";
import { Messenger } from "./Messenger";
import { MobileCore } from "./MobileCore";

/** Properties for [[ActionSheet.show]]
 * @public
 */
export interface ActionSheetProps {
  /** Optional title to show on the action sheet. */
  title?: string;
  /** Optional message to show on the action sheet. */
  message?: string;
  /** Actions to perform by the action sheet.
   *
   * Note: If no action with an ActionStyle of Cancel is present, a default cancel action will be automatically
   * provided unless skipCancel is set to true. Note that iPads allow cancelation even if there is no cancel action,
   * but phones don't. Consequently, not allowing cancel on phones should be extremely rare.
   */
  actions: AlertActions;
  /** If set to true, prevents the default Cancel action from being added, default is false. */
  skipCancel?: boolean;
}

/**
 * Function to present a native action sheet and return the user's selection.
 * @param props The properties of the action sheet.
 * @param sourceRect The bounding rectangle of the control that is showing the action sheet.
 * @param senderId The optional sender ID to use for messaging. If undefined, this will be auto-generated.
 * @returns The name of the action the user selected, or nil if the user cancels. If you set the onSelected
 *          callback for each [[AlertAction]], you can ignore the return value.
 * @public
 */
export async function presentActionSheet(props: ActionSheetProps, sourceRect: DOMRect) {
  const { message, title, actions: propsActions, skipCancel = false } = props;
  const actions = await extractAlertActions(propsActions);
  const messageData = {
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
    });
  }
  const result: string | undefined = await Messenger.query("Bentley_ITM_presentActionSheet", messageData);
  callOnSelected(result, actions);
  if (result === "itm_cancel") {
    return null;
  }
  return result;
}
