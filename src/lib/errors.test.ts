// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, test, describe } from "@jest/globals";
import * as fc from "fast-check";
import { Errors, ErrorList, ValidateError } from "./errors";

describe("ValidateError Fuzz Testing", () => {
  test("should only accept predefined error values", () => {
    fc.assert(
      fc.property(fc.string(), error => {
        if (ErrorList.includes(error)) {
          expect(() => ValidateError(error)).not.toThrow();
        } else {
          expect(() => ValidateError(error)).toThrow(
            `Invalid error: ${error}. Must be one of: ${ErrorList.join(", ")}`,
          );
        }
      }),
      { verbose: true },
    );
  });
});
describe("ValidateError Fake Data Testing", () => {
  test("should correctly handle typical fake error data", () => {
    const fakeErrors = ["error", "failure", "null", "undefined", "exception"];
    fakeErrors.forEach(fakeError => {
      if (ErrorList.includes(fakeError)) {
        expect(() => ValidateError(fakeError)).not.toThrow();
      } else {
        expect(() => ValidateError(fakeError)).toThrow(
          `Invalid error: ${fakeError}. Must be one of: ${ErrorList.join(", ")}`,
        );
      }
    });
  });
});
describe("ValidateError Property-Based Testing", () => {
  test("should only validate errors that are part of the ErrorList", () => {
    fc.assert(
      fc.property(fc.constantFrom(...ErrorList), validError => {
        expect(() => ValidateError(validError)).not.toThrow();
      }),
      { verbose: true },
    );

    fc.assert(
      fc.property(
        fc.string().filter(e => !ErrorList.includes(e)),
        invalidError => {
          expect(() => ValidateError(invalidError)).toThrow(
            `Invalid error: ${invalidError}. Must be one of: ${ErrorList.join(", ")}`,
          );
        },
      ),
      { verbose: true },
    );
  });
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
