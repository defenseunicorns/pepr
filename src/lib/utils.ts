// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import Log from "./logger";

/** Test if a string is ascii or not */
export const isAscii = /^[\s\x20-\x7E]*$/;

/**
 * Encode all ascii values in a map to base64
 * @param obj The object to encode
 * @param skip A list of keys to skip encoding
 */
export function convertToBase64Map(obj: { data?: Record<string, string> }, skip: string[]) {
  obj.data = obj.data ?? {};
  for (const key in obj.data) {
    const value = obj.data[key];
    // Only encode ascii values
    obj.data[key] = skip.includes(key) ? value : Buffer.from(value).toString("base64");
  }
}

/**
 * Decode all ascii values in a map from base64 to utf-8
 * @param obj The object to decode
 * @returns A list of keys that were skipped
 */
export function convertFromBase64Map(obj: { data?: Record<string, string> }) {
  const skip: string[] = [];

  obj.data = obj.data ?? {};
  for (const key in obj.data) {
    const decoded = Buffer.from(obj.data[key], "base64").toString("utf-8");
    if (isAscii.test(decoded)) {
      // Only decode ascii values
      obj.data[key] = decoded;
    } else {
      skip.push(key);
    }
  }

  Log.debug(`Non-ascii data detected in keys: ${skip}, skipping automatic decoding`);

  return skip;
}
