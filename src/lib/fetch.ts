// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { StatusCodes } from "http-status-codes";
import f, { RequestInfo, RequestInit } from "node-fetch";
import logger from "./logger";
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
  try {
    logger.debug(`Fetching ${url}`);

    const resp = await f(url, init);
    const contentType = resp.headers.get("content-type");

    let data: T;

    if (resp.ok) {
      // Parse the response as JSON if the content type is JSON
      if (contentType.includes("application/json")) {
        data = await resp.json();
      } else {
        // Otherwise, return however the response was read
        data = (await resp.text()) as unknown as T;
      }
    }

    return {
      data,
      ok: resp.ok,
      status: resp.status,
      statusText: resp.statusText,
    };
  } catch (e) {
    logger.debug(`Fetch failed: ${e.message}`);

    return {
      data: null,
      ok: false,
      status: e.code || StatusCodes.BAD_REQUEST,
      statusText: e.message,
    };
  }
}
