// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import f, { RequestInfo, RequestInit } from "node-fetch";
export { f as fetchRaw };

/**
 * Perform an async HTTP call and return the parsed JSON response, optionally
 * as a specific type.
 *
 * @example
 * ```ts
 * fetch<string[]>("https://example.com/api/foo");
 * ```
 *
 * @param url The URL or Request object to fetch
 * @param init Additional options for the request
 * @returns
 */
export async function fetch<T>(url: URL | RequestInfo, init?: RequestInit) {
  const resp = await f(url, init);

  // Throw an error if the response is not OK
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json();
  return data as T;
}
