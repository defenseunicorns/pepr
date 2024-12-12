// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import Log from "./telemetry/logger";

/** Test if a string is ascii or not */
export const isAscii: RegExp = /^[\s\x20-\x7E]*$/;

/**
 * Encode all ascii values in a map to base64
 * @param obj The object to encode
 * @param skip A list of keys to skip encoding
 */
export function convertToBase64Map(obj: { data?: Record<string, string> }, skip: string[]): void {
  obj.data = obj.data ?? {};
  for (const key in obj.data) {
    const value = obj.data[key];
    // Only encode ascii values
    obj.data[key] = skip.includes(key) ? value : base64Encode(value);
  }
}

/**
 * Decode all ascii values in a map from base64 to utf-8
 * @param obj The object to decode
 * @returns A list of keys that were skipped
 */
export function convertFromBase64Map(obj: { data?: Record<string, string> }): string[] {
  const skip: string[] = [];

  obj.data = obj.data ?? {};
  for (const key in obj.data) {
    if (obj.data[key] === undefined) {
      obj.data[key] = "";
    } else {
      const decoded = base64Decode(obj.data[key]);
      if (isAscii.test(decoded)) {
        // Only decode ascii values
        obj.data[key] = decoded;
      } else {
        skip.push(key);
      }
    }
  }
  Log.debug(`Non-ascii data detected in keys: ${skip}, skipping automatic base64 decoding`);
  return skip;
}

/** Decode a base64 string */
export function base64Decode(data: string): string {
  return Buffer.from(data, "base64").toString("utf-8");
}

/** Encode a string to base64 */
export function base64Encode(data: string): string {
  return Buffer.from(data).toString("base64");
}
