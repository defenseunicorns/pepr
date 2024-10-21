"use strict";
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Kubernetes Fluent Client Authors
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const http_status_codes_1 = require("http-status-codes");
const nock_1 = __importDefault(require("nock"));
const fetch_1 = require("./fetch");
(0, globals_1.beforeEach)(() => {
    (0, nock_1.default)("https://jsonplaceholder.typicode.com")
        .get("/todos/1")
        .reply(200, {
        userId: 1,
        id: 1,
        title: "Example title",
        completed: false,
    })
        .post("/todos", {
        title: "test todo",
        userId: 1,
        completed: false,
    })
        .reply(200, (uri, requestBody) => requestBody)
        .get("/todos/empty-null")
        .reply(200, undefined)
        .get("/todos/empty-string")
        .reply(200, "")
        .get("/todos/empty-object")
        .reply(200, {})
        .get("/todos/invalid")
        .replyWithError("Something bad happened");
});
(0, globals_1.test)("fetch: should return without type data", async () => {
    const url = "https://jsonplaceholder.typicode.com/todos/1";
    const { data, ok } = await (0, fetch_1.fetch)(url);
    (0, globals_1.expect)(ok).toBe(true);
    (0, globals_1.expect)(data["title"]).toBe("Example title");
});
(0, globals_1.test)("fetch: should return parsed JSON response as a specific type", async () => {
    const url = "https://jsonplaceholder.typicode.com/todos/1";
    const { data, ok } = await (0, fetch_1.fetch)(url);
    (0, globals_1.expect)(ok).toBe(true);
    (0, globals_1.expect)(data.id).toBe(1);
    (0, globals_1.expect)(typeof data.title).toBe("string");
    (0, globals_1.expect)(typeof data.completed).toBe("boolean");
});
(0, globals_1.test)("fetch: should handle additional request options", async () => {
    const url = "https://jsonplaceholder.typicode.com/todos";
    const requestOptions = {
        method: "POST",
        body: JSON.stringify({
            title: "test todo",
            userId: 1,
            completed: false,
        }),
        headers: {
            "Content-type": "application/json; charset=UTF-8",
        },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, ok } = await (0, fetch_1.fetch)(url, requestOptions);
    (0, globals_1.expect)(ok).toBe(true);
    (0, globals_1.expect)(data["title"]).toBe("test todo");
    (0, globals_1.expect)(data["userId"]).toBe(1);
    (0, globals_1.expect)(data["completed"]).toBe(false);
});
(0, globals_1.test)("fetch: should handle empty (null) responses", async () => {
    const url = "https://jsonplaceholder.typicode.com/todos/empty-null";
    const resp = await (0, fetch_1.fetch)(url);
    (0, globals_1.expect)(resp.data).toBe("");
    (0, globals_1.expect)(resp.ok).toBe(true);
    (0, globals_1.expect)(resp.status).toBe(http_status_codes_1.StatusCodes.OK);
});
(0, globals_1.test)("fetch: should handle empty (string) responses", async () => {
    const url = "https://jsonplaceholder.typicode.com/todos/empty-string";
    const resp = await (0, fetch_1.fetch)(url);
    (0, globals_1.expect)(resp.data).toBe("");
    (0, globals_1.expect)(resp.ok).toBe(true);
    (0, globals_1.expect)(resp.status).toBe(http_status_codes_1.StatusCodes.OK);
});
(0, globals_1.test)("fetch: should handle empty (object) responses", async () => {
    const url = "https://jsonplaceholder.typicode.com/todos/empty-object";
    const resp = await (0, fetch_1.fetch)(url);
    (0, globals_1.expect)(resp.data).toEqual({});
    (0, globals_1.expect)(resp.ok).toBe(true);
    (0, globals_1.expect)(resp.status).toBe(http_status_codes_1.StatusCodes.OK);
});
(0, globals_1.test)("fetch: should handle failed requests without throwing an error", async () => {
    const url = "https://jsonplaceholder.typicode.com/todos/invalid";
    const resp = await (0, fetch_1.fetch)(url);
    (0, globals_1.expect)(resp.data).toBe(undefined);
    (0, globals_1.expect)(resp.ok).toBe(false);
    (0, globals_1.expect)(resp.status).toBe(http_status_codes_1.StatusCodes.BAD_REQUEST);
});
