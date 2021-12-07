/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AuthorizationClient } from "@itwin/core-common";
import { Messenger } from "./Messenger";

export class ITMAuthorizationClient implements AuthorizationClient {
  public async getAccessToken() {
    return (await Messenger.query("Bentley_ITM_getAccessToken")) as string;
  }
}
