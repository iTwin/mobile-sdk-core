/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ActionStyle, AlertActions, callOnSelected, extractAlertActions } from "./Alert";
import { Messenger } from "./Messenger";
import { MobileCore } from "./MobileCore";

/**
 * Gravity used by [[ActionSheetProps]] on Android.
 * @public
 */
export enum ActionSheetGravity {
  Top = "top",
  Bottom = "bottom",
  Left = "left",
  Right = "right",
  TopLeft = "topLeft",
  TopRight = "topRight",
  BottomLeft = "bottomLeft",
  BottomRight = "bottomRight",
}

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
  /** Whether or not to show the status bar during the alert, default is false. */
  showStatusBar?: boolean;
  /** _Android only:_ The gravity to use when displaying the PopupMenu. */
  gravity?: ActionSheetGravity;
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
  const { message, title, showStatusBar, actions: propsActions, skipCancel = false, gravity } = props;
  const actions = await extractAlertActions(propsActions);
  const messageData = {
    title,
    message,
    showStatusBar,
    style: "actionSheet",
    sourceRect,
    gravity,
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
  // Disable pointer events in all viewports for the duration that the action sheet is
  // visible. Without this, if the user taps outside the popover, that tap can trigger an
  // event (typically selection) in the viewport.
  const disabledDivs = MobileCore.disableAllViewportPointerEvents();
  // Send the query so the native code will display the action sheet, and wait for the result.
  const result: string | undefined = await Messenger.query("Bentley_ITM_presentActionSheet", messageData);
  // Reenabled pointer events in all viewports where we disabled them above.
  MobileCore.reenableViewportPointerEvents(disabledDivs);
  callOnSelected(result, actions);
  if (result === "itm_cancel") {
    return null;
  }
  return result;
}
