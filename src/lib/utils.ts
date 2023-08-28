// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

/** Decode all values in a map from base64 to utf-8 */
export function convertFromBase64Map(obj: { data?: Record<string, string> }) {
  obj.data = obj.data ?? {};
  for (const key in obj.data) {
    obj.data[key] = base64Decode(obj.data[key]);
  }
}

/** Encode all values in a map to base64 */
export function convertToBase64Map(obj: { data?: Record<string, string> }) {
  obj.data = obj.data ?? {};
  for (const key in obj.data) {
    obj.data[key] = base64Encode(obj.data[key]);
  }
}

/** Decode a base64 string to utf-8 */
export function base64Decode(data: string) {
  return Buffer.from(data, "base64").toString("utf-8");
}

/** Encode a string to base64 */
export function base64Encode(data: string) {
  return Buffer.from(data).toString("base64");
}
