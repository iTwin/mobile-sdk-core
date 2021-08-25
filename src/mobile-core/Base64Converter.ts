/*---------------------------------------------------------------------------------------------
* Copyright (c) 2021 Bentley Systems, Incorporated. All rights reserved.
*--------------------------------------------------------------------------------------------*/
import * as base64 from "base64-js";

/** Convert a Base64-encoded UTF-8 string to a JavaScript string.
 * @public
 */
export class Base64Converter {
  /** Convert a Base64-encoded UTF-8 string into a JavaScript string.
   * @param base64String: The Base64-encoded UTF-8 string to convert.
   * @returns A JavaScript string corresponding to the UTF-8 string.
   * @public
   */
  public static base64Utf8ToString(base64String: string): string {
    return Base64Converter.utf8ToString(base64.toByteArray(base64String));
  }

  /** Convert an array of Uint8 values representing a UTF-8 string into a JavaScript string.
   * @param utf8: Array of Uint8 values representing a UTF-8 string.
   * @returns JavaScript string corresponding to the UTF-8 data.
   * @public
   */
  private static utf8ToString(utf8: Uint8Array) {
    let s = "";
    for (const utf8c of utf8) {
      // Convert UTF-8 byte to a hex string.
      let h = utf8c.toString(16);
      if (h.length < 2) {
        // Add 0 prefix for byte values of 0-15 so that hex string is always two digits.
        h = "0" + h;
      }
      s += "%" + h;
    }
    return decodeURIComponent(s);
  }
}
