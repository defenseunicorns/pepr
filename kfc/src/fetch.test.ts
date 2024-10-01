// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Kubernetes Fluent Client Authors

import { expect, test, beforeEach } from "@jest/globals";

import { StatusCodes } from "http-status-codes";
import nock from "nock";
import { RequestInit } from "node-fetch";
import { fetch } from "./fetch";

beforeEach(() => {
  nock("https://jsonplaceholder.typicode.com")
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

test("fetch: should return without type data", async () => {
  const url = "https://jsonplaceholder.typicode.com/todos/1";
  const { data, ok } = await fetch<{ title: string }>(url);
  expect(ok).toBe(true);
  expect(data["title"]).toBe("Example title");
});

test("fetch: should return parsed JSON response as a specific type", async () => {
  interface Todo {
    userId: number;
    id: number;
    title: string;
    completed: boolean;
  }

  const url = "https://jsonplaceholder.typicode.com/todos/1";
  const { data, ok } = await fetch<Todo>(url);
  expect(ok).toBe(true);
  expect(data.id).toBe(1);
  expect(typeof data.title).toBe("string");
  expect(typeof data.completed).toBe("boolean");
});

test("fetch: should handle additional request options", async () => {
  const url = "https://jsonplaceholder.typicode.com/todos";
  const requestOptions: RequestInit = {
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
  const { data, ok } = await fetch<any>(url, requestOptions);
  expect(ok).toBe(true);
  expect(data["title"]).toBe("test todo");
  expect(data["userId"]).toBe(1);
  expect(data["completed"]).toBe(false);
});

test("fetch: should handle empty (null) responses", async () => {
  const url = "https://jsonplaceholder.typicode.com/todos/empty-null";
  const resp = await fetch(url);

  expect(resp.data).toBe("");
  expect(resp.ok).toBe(true);
  expect(resp.status).toBe(StatusCodes.OK);
});

test("fetch: should handle empty (string) responses", async () => {
  const url = "https://jsonplaceholder.typicode.com/todos/empty-string";
  const resp = await fetch(url);

  expect(resp.data).toBe("");
  expect(resp.ok).toBe(true);
  expect(resp.status).toBe(StatusCodes.OK);
});

test("fetch: should handle empty (object) responses", async () => {
  const url = "https://jsonplaceholder.typicode.com/todos/empty-object";
  const resp = await fetch(url);

  expect(resp.data).toEqual({});
  expect(resp.ok).toBe(true);
  expect(resp.status).toBe(StatusCodes.OK);
});

test("fetch: should handle failed requests without throwing an error", async () => {
  const url = "https://jsonplaceholder.typicode.com/todos/invalid";
  const resp = await fetch(url);

  expect(resp.data).toBe(undefined);
  expect(resp.ok).toBe(false);
  expect(resp.status).toBe(StatusCodes.BAD_REQUEST);
});
