import { RequestInfo, RequestInit } from "node-fetch";
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
export declare function fetch<T>(url: URL | RequestInfo, init?: RequestInit): Promise<FetchResponse<T>>;
//# sourceMappingURL=fetch.d.ts.map