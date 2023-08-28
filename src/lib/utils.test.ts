// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import test from "ava";
import { base64Encode, base64Decode, convertToBase64Map, convertFromBase64Map } from "./utils";

const nonAsciiText = "🦄🚀🌍🌟";

test("base64Encode", t => {
  const testCases: Array<[string, string]> = [
    ["hello", "aGVsbG8="],
    ["world", "d29ybGQ="],
    ["12345", "MTIzNDU="],
    ["", ""],
    [nonAsciiText, "8J+mhPCfmoDwn4yN8J+Mnw=="],
  ];

  for (const [input, expected] of testCases) {
    const encoded = base64Encode(input);
    t.is(encoded, expected);
  }
});

test("base64Decode", t => {
  const testCases: Array<[string, string]> = [
    ["aGVsbG8=", "hello"],
    ["d29ybGQ=", "world"],
    ["MTIzNDU=", "12345"],
    ["", ""],
    ["8J+mhPCfmoDwn4yN8J+Mnw==", nonAsciiText],
  ];

  for (const [input, expected] of testCases) {
    const decoded = base64Decode(input);
    t.is(decoded, expected);
  }
});

test("convertToBase64Map", t => {
  const obj = {
    data: {
      key1: "value1",
      key2: "hello",
      key3: "",
    },
  };

  convertToBase64Map(obj);

  t.is(obj.data.key1, base64Encode("value1"));
  t.is(obj.data.key2, base64Encode("hello"));
  t.is(obj.data.key3, base64Encode(""));
});

test("convertFromBase64Map", t => {
  const obj = {
    data: {
      key1: "aGVsbG8=",
      key2: "d29ybGQ=",
      key3: "",
    },
  };

  convertFromBase64Map(obj);

  t.is(obj.data.key1, "hello");
  t.is(obj.data.key2, "world");
  t.is(obj.data.key3, "");
});
