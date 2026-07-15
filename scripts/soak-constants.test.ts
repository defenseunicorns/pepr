// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2024-Present The Pepr Authors

import { describe, it, expect } from "vitest";

import { parseEnvNumber } from "./soak-constants.js";

describe("parseEnvNumber", () => {
  it.each([
    {
      input: undefined,
      fallback: 10,
      expected: 10,
      desc: "returns the default when envVar is undefined",
    },
    {
      input: "",
      fallback: 10,
      expected: 10,
      desc: "returns the default when envVar is empty string",
    },
    {
      input: "abc",
      fallback: 10,
      expected: 10,
      desc: "returns the default when envVar is not a number",
    },
    { input: "42", fallback: 10, expected: 42, desc: "parses a valid positive number" },
    {
      input: "0",
      fallback: 10,
      expected: 0,
      desc: "respects an explicit 0 value (does not treat 0 as falsy)",
    },
  ])("$desc (input=$input, fallback=$fallback)", ({ input, fallback, expected }) => {
    expect(parseEnvNumber(input, fallback)).toBe(expected);
  });
});
