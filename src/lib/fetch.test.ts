// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
// fetch.test.ts

import test from "ava";
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
    .reply(201, (uri, requestBody) => requestBody);
});

test("fetch: should return without type data", async t => {
  const url = "https://jsonplaceholder.typicode.com/todos/1";
  const response = await fetch(url);
  t.is(response["title"], "Example title");
});

test("fetch: should return parsed JSON response as a specific type", async t => {
  interface Todo {
    userId: number;
    id: number;
    title: string;
    completed: boolean;
  }

  const url = "https://jsonplaceholder.typicode.com/todos/1";
  const data = await fetch<Todo>(url);
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

  const data = await fetch(url, requestOptions);
  t.is(data["title"], "test todo");
  t.is(data["userId"], 1);
  t.is(data["completed"], false);
});
