// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, it, describe } from "@jest/globals";
import * as fc from "fast-check";
import { ErrorList, ValidateError } from "./errors";
import { OnError } from "../cli/init/enums";

describe("ValidateError Fuzz Testing", () => {
  it("should only accept predefined error values", () => {
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
  it("should correctly handle typical fake error data", () => {
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
  it("should only validate errors that are part of the ErrorList", () => {
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

it("Errors object should have correct properties", () => {
  expect(OnError).toEqual({
    AUDIT: "audit",
    IGNORE: "ignore",
    REJECT: "reject",
  });
});

it("ValidateError should not throw an error for valid errors", () => {
  expect(() => {
    ValidateError("audit");
    ValidateError("ignore");
    ValidateError("reject");
  }).not.toThrow();
});

it("ValidateError should throw an error for invalid errors", () => {
  expect(() => ValidateError("invalidError")).toThrowError({
    message: "Invalid error: invalidError. Must be one of: audit, ignore, reject",
  });
});
