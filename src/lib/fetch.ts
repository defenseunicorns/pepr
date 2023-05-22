// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { StatusCodes } from "http-status-codes";
import f, { FetchError, RequestInfo, RequestInit } from "node-fetch";
import logger from "./logger";

export const fetchRaw = f;

export type FetchResponse<T> = {
  data: T;
  ok: boolean;
  status: number;
  statusText: string;
};

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
export async function fetch<T>(url: URL | RequestInfo, init?: RequestInit): Promise<FetchResponse<T>> {
  let data = undefined as unknown as T;
  try {
    logger.debug(`Fetching ${url}`);

    const resp = await fetchRaw(url, init);
    const contentType = resp.headers.get("content-type") || "";

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
    if (e instanceof FetchError) {
      logger.debug(`Fetch failed: ${e instanceof Error ? e.message : e}`);

      // Parse the error code from the FetchError or default to 400 (Bad Request)
      const status = parseInt(e.code || "400");

      return {
        data,
        ok: false,
        status,
        statusText: e.message,
      };
    }

    return {
      data,
      ok: false,
      status: StatusCodes.BAD_REQUEST,
      statusText: "Unknown error",
    };
  }
}
