// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import Log from "./logger";

/** Base64 encode all values in a map */
export function convertToBase64Map(obj: { data?: Record<string, string> }) {
  obj.data = obj.data ?? {};

  for (const key in obj.data) {
    const value = obj.data[key];
    obj.data[key] = base64Encode(value);
  }
}

/** Base64 decode all values in a map */
export function convertFromBase64Map(obj: { data?: Record<string, string | Buffer> }) {
  obj.data = obj.data ?? {};

  for (const key in obj.data) {
    const value = obj.data[key];
    obj.data[key] = base64Decode(value);
  }
}

/**
 * Decode a base64 string to a Buffer.
 * A Buffer is used to handle binary data accurately without unintended character encoding conversions.
 * @param data The base64 encoded string or Buffer containing binary data
 * @returns A Buffer containing the decoded data
 */
export function base64Decode(data: string | Buffer): Buffer {
  switch (typeof data) {
    case "string":
      return Buffer.from(data, "base64");
    case "object":
      if (Buffer.isBuffer(data)) {
        return data;
      }
      break;
    default:
      Log.debug(`Invalid input type for base64Decode: value=${data} type=${typeof data}`);
      return Buffer.from([]);
  }

  return Buffer.from([]);
}

/**
 * Encode a string or Buffer to a base64 string.
 * @param data The input string or Buffer to be encoded
 * @returns A base64 encoded string
 */
export function base64Encode(data: string | Buffer): string {
  return Buffer.from(data).toString("base64");
}
