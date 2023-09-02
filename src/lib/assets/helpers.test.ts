// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
// helpers.test.ts

import test from "ava";
import { extractLabelsFromCapabilities } from "./helpers";
import { ModuleCapabilities } from "./loader";
import { Binding } from "../types";

test("extractLabelsFromAssets", t => {
  const hash = "1234567890";
  const blankBinding: Binding[] = [];
  const testCases: Array<[ModuleCapabilities[], { [key: string]: string }]> = [
    [
      [
        {
          _name: "hello-pepr",
          _description: "",
          _namespaces: ["", ""],
          _bindings: blankBinding,
        },
        {
          _name: "goodbye-pepr",
          _description: "",
          _namespaces: ["", ""],
          _bindings: blankBinding,
        },
        {
          _name: "hello-world",
          _description: "",
          _namespaces: ["", ""],
          _bindings: blankBinding,
        },
        {
          _name: "goodbye-world",
          _description: "",
          _namespaces: ["", ""],
          _bindings: blankBinding,
        },
      ],
      {
        "hello-pepr": hash,
        "goodbye-pepr": hash,
        "hello-world": hash,
        "goodbye-world": hash,
      },
    ],
    [
      [
        {
          _name: "hello-leapfrog",
          _description: "",
          _namespaces: ["", ""],
          _bindings: blankBinding,
        },
        {
          _name: "goodbye-leapfrog",
          _description: "",
          _namespaces: ["", ""],
          _bindings: blankBinding,
        },
        {
          _name: "hello-uds",
          _description: "",
          _namespaces: ["", ""],
          _bindings: blankBinding,
        },
        {
          _name: "goodbye-uds",
          _description: "",
          _namespaces: ["", ""],
          _bindings: blankBinding,
        },
      ],
      {
        "hello-leapfrog": hash,
        "goodbye-leapfrog": hash,
        "hello-uds": hash,
        "goodbye-uds": hash,
      },
    ],
    [
      [
        {
          _name: "hello-zarf",
          _description: "",
          _namespaces: ["", ""],
          _bindings: blankBinding,
        },
        {
          _name: "goodbye-zarf",
          _description: "",
          _namespaces: ["", ""],
          _bindings: blankBinding,
        },
        {
          _name: "hello-earth",
          _description: "",
          _namespaces: ["", ""],
          _bindings: blankBinding,
        },
        {
          _name: "goodbye-earth",
          _description: "",
          _namespaces: ["", ""],
          _bindings: blankBinding,
        },
      ],
      {
        "hello-zarf": hash,
        "goodbye-zarf": hash,
        "hello-earth": hash,
        "goodbye-earth": hash,
      },
    ],
  ];

  for (const [input, expected] of testCases) {
    const labels = extractLabelsFromCapabilities(input, hash);
    t.is(labels, expected);
  }
});
