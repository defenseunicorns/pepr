"use strict";
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Kubernetes Fluent Client Authors
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetch = fetch;
const http_status_codes_1 = require("http-status-codes");
const node_fetch_1 = __importStar(require("node-fetch"));
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
async function fetch(url, init) {
    let data = undefined;
    try {
        const resp = await (0, node_fetch_1.default)(url, init);
        const contentType = resp.headers.get("content-type") || "";
        // Parse the response as JSON if the content type is JSON
        if (contentType.includes("application/json")) {
            data = await resp.json();
        }
        else {
            // Otherwise, return however the response was read
            data = (await resp.text());
        }
        return {
            data,
            ok: resp.ok,
            status: resp.status,
            statusText: resp.statusText,
        };
    }
    catch (e) {
        if (e instanceof node_fetch_1.FetchError) {
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
            status: http_status_codes_1.StatusCodes.BAD_REQUEST,
            statusText: "Unknown error",
        };
    }
}
