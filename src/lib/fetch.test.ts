// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
// fetch.test.ts

import test from "ava";
import { StatusCodes } from "http-status-codes";
import nock from "nock";
import { RequestInit } from "node-fetch";
import { fetch } from "./fetch";

test.beforeEach(() => {
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
    .reply(200, null)
    .get("/todos/empty-string")
    .reply(200, "")
    .get("/todos/empty-object")
    .reply(200, {})
    .get("/todos/invalid")
    .replyWithError("Something bad happened");
});

test("fetch: should return without type data", async t => {
  const url = "https://jsonplaceholder.typicode.com/todos/1";
  const { data, ok } = await fetch(url);
  t.is(ok, true);
  t.is(data["title"], "Example title");
});

test("fetch: should return parsed JSON response as a specific type", async t => {
  interface Todo {
    userId: number;
    id: number;
    title: string;
    completed: boolean;
  }

  const url = "https://jsonplaceholder.typicode.com/todos/1";
  const { data, ok } = await fetch<Todo>(url);
  t.is(ok, true);
  t.is(data.id, 1);
  t.is(typeof data.title, "string");
  t.is(typeof data.completed, "boolean");
});

test("fetch: should handle additional request options", async t => {
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

  const { data, ok } = await fetch(url, requestOptions);
  t.is(ok, true);
  t.is(data["title"], "test todo");
  t.is(data["userId"], 1);
  t.is(data["completed"], false);
});

test("fetch: should handle empty (null) responses", async t => {
  const url = "https://jsonplaceholder.typicode.com/todos/empty-null";
  const resp = await fetch(url);

  t.is(resp.data, null);
  t.is(resp.ok, true);
  t.is(resp.status, StatusCodes.OK);
});

test("fetch: should handle empty (string) responses", async t => {
  const url = "https://jsonplaceholder.typicode.com/todos/empty-string";
  const resp = await fetch(url);

  t.is(resp.data, "");
  t.is(resp.ok, true);
  t.is(resp.status, StatusCodes.OK);
});

test("fetch: should handle empty (object) responses", async t => {
  const url = "https://jsonplaceholder.typicode.com/todos/empty-object";
  const resp = await fetch(url);

  t.deepEqual(resp.data, {});
  t.is(resp.ok, true);
  t.is(resp.status, StatusCodes.OK);
});

test("fetch: should handle failed requests without throwing an error", async t => {
  const url = "https://jsonplaceholder.typicode.com/todos/invalid";
  const resp = await fetch(url);

  t.is(resp.data, null);
  t.is(resp.ok, false);
  t.is(resp.status, StatusCodes.BAD_REQUEST);
});
