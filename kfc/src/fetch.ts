// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Kubernetes Fluent Client Authors

import { StatusCodes } from "http-status-codes";
import fetchRaw, { FetchError, RequestInfo, RequestInit } from "node-fetch";

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
 * @returns The parsed JSON response
 */
export async function fetch<T>(
  url: URL | RequestInfo,
  init?: RequestInit,
): Promise<FetchResponse<T>> {
  let data = undefined as unknown as T;
  try {
    const resp = await fetchRaw(url, init);
    const contentType = resp.headers.get("content-type") || "";

    // Parse the response as JSON if the content type is JSON
    if (contentType.includes("application/json")) {
      data = await resp.json();
    } else {
      // Otherwise, return however the response was read
      data = (await resp.text()) as unknown as T;
    }

    return {
      data,
      ok: resp.ok,
      status: resp.status,
      statusText: resp.statusText,
    };
  } catch (e) {
    if (e instanceof FetchError) {
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
