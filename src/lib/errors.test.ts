// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, test } from "@jest/globals";
import * as fc from "fast-check";
import { Errors, ErrorList, ValidateError } from "./errors";

// Property based test
test("should always return the key as its value for each property", () => {
  type ErrorKey = keyof typeof Errors;
  fc.assert(
    fc.property(fc.constantFrom<ErrorKey>("audit", "ignore", "reject"), key => {
      expect(Errors[key]).toEqual(key);
    }),
  );
});

test("Errors object should have correct properties", () => {
  expect(Errors).toEqual({
    audit: "audit",
    ignore: "ignore",
    reject: "reject",
  });
});

test("ErrorList should contain correct values", () => {
  expect(ErrorList).toEqual(["audit", "ignore", "reject"]);
});

test("ValidateError should not throw an error for valid errors", () => {
  expect(() => {
    ValidateError("audit");
    ValidateError("ignore");
    ValidateError("reject");
  }).not.toThrow();
});

test("ValidateError should throw an error for invalid errors", () => {
  expect(() => ValidateError("invalidError")).toThrowError({
    message: "Invalid error: invalidError. Must be one of: audit, ignore, reject",
  });
});
