/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AuthorizationClient } from "@itwin/core-common";
import { Messenger } from "./Messenger";

export class ITMAuthorizationClient implements AuthorizationClient {

  /**
   * Get the AccessToken of the currently authorized user, or blank string if no token is available.
   * @returns A promise that resolves to a string representing the access token.
   */
  public async getAccessToken() {
    return (await Messenger.query("Bentley_ITMAuthorizationClient_getAccessToken")) as string;
  }

  /**
   * Sign the user out.
   * @returns A promise that resolves to void.
   */
  public async signOut() {
    return (await Messenger.query("Bentley_ITMAuthorizationClient_signOut")) as void;
  }
}
