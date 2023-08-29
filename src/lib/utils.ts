// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import Log from "./logger";

type Base64ConvertibleValue = string | Buffer;

interface Base64Map {
  data?: Record<string, Base64ConvertibleValue>;
}

/** Base64 encode all values in a map */
export function convertToBase64Map(obj: Base64Map): Base64Map {
  const newObj: Base64Map = { ...obj };
  newObj.data = newObj.data ?? {};

  for (const key in newObj.data) {
    const value = newObj.data[key];
    newObj.data[key] = base64Encode(value);
  }

  return newObj;
}

/** Base64 decode all values in a map */
export function convertFromBase64Map(obj: Base64Map): Base64Map {
  const newObj: Base64Map = { ...obj };
  newObj.data = newObj.data ?? {};

  for (const key in newObj.data) {
    const value = newObj.data[key];
    newObj.data[key] = base64Decode(value);
  }

  return newObj;
}

/**
 * Decode a base64 string to a Buffer.
 * A Buffer is used to handle binary data accurately without unintended character encoding conversions.
 * @param data The base64 encoded string or Buffer containing binary data
 * @returns A Buffer containing the decoded data, or an empty Buffer in case of errors
 */
export function base64Decode(data: Base64ConvertibleValue): Buffer {
  try {
    if (typeof data === "string") {
      return Buffer.from(data, "base64");
    } else if (Buffer.isBuffer(data)) {
      return data;
    }
  } catch (error) {
    Log.error(`Error decoding base64 data: ${error}`);
  }

  return Buffer.from([]);
}

/**
 * Encode a string or Buffer to a base64 string.
 * @param data The input string or Buffer to be encoded
 * @returns A base64 encoded string
 */
export function base64Encode(data: Base64ConvertibleValue): string {
  return Buffer.from(data).toString("base64");
}
