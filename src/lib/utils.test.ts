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
  const testCases: Array<[string, Buffer]> = [
    ["", Buffer.from("", "utf-8")],
    ["aGVsbG8=", Buffer.from("hello", "utf-8")],
    ["d29ybGQ=", Buffer.from("world", "utf-8")],
    ["MTIzNDU=", Buffer.from("12345", "utf-8")],
    ["8J+mhPCfmoDwn4yN8J+Mnw==", Buffer.from(nonAsciiText, "utf-8")],
  ];

  for (const [input, expected] of testCases) {
    const decoded = base64Decode(input);
    t.deepEqual(decoded, expected);
  }
});

test("convertToBase64Map", t => {
  const obj = {
    data: {
      key1: "value1",
      key2: "hello",
      key3: "",
      key4: nonAsciiText,
    },
  };

  convertToBase64Map(obj);

  t.is(obj.data.key1, base64Encode("value1"));
  t.is(obj.data.key2, base64Encode("hello"));
  t.is(obj.data.key3, base64Encode(""));
  t.is(obj.data.key4, base64Encode(nonAsciiText));
});

test("convertFromBase64Map", t => {
  const obj = {
    data: {
      key1: "aGVsbG8=",
      key2: "d29ybGQ=",
      key3: "",
      key4: "8J+mhPCfmoDwn4yN8J+Mnw==",
    },
  };

  convertFromBase64Map(obj);

  t.deepEqual(obj.data.key1, Buffer.from("hello", "utf-8"));
  t.deepEqual(obj.data.key2, Buffer.from("world", "utf-8"));
  t.deepEqual(obj.data.key3, Buffer.from("", "utf-8"));
  t.deepEqual(obj.data.key4, Buffer.from(nonAsciiText, "utf-8"));
});

test("should return identical encoded binary data after base64 decoding and re-encoding", t => {
  const encodedBinaryData =
    "iCZQUg8xYucNUqD+8lyl2YcKjYYygvTtiDSEV9b9WKUkxSSLFJTgIWMJ9GcFFYs4T9JCdda51u74jfq8yHzRuEASl60EdTS/NfWgIIFTGqcNRfqMw+vgpyTMmCyJVaJEDFq6AA==";

  const decoded = base64Decode(encodedBinaryData);
  const encoded = base64Encode(decoded);

  t.is(encoded, encodedBinaryData);
});
