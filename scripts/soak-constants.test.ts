// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2024-Present The Pepr Authors

import { describe, it, expect } from "vitest";

import { parseEnvNumber } from "./soak-constants.js";

describe("parseEnvNumber", () => {
  it("returns the default when envVar is undefined", () => {
    expect(parseEnvNumber(undefined, 10)).toBe(10);
  });

  it("returns the default when envVar is empty string", () => {
    expect(parseEnvNumber("", 10)).toBe(10);
  });

  it("returns the default when envVar is not a number", () => {
    expect(parseEnvNumber("abc", 10)).toBe(10);
  });

  it("parses a valid positive number", () => {
    expect(parseEnvNumber("42", 10)).toBe(42);
  });

  it("respects an explicit 0 value (does not treat 0 as falsy)", () => {
    expect(parseEnvNumber("0", 10)).toBe(0);
  });

  it("parses negative numbers", () => {
    expect(parseEnvNumber("-5", 10)).toBe(-5);
  });

  it("parses floating point numbers", () => {
    expect(parseEnvNumber("3.14", 10)).toBe(3.14);
  });
});
