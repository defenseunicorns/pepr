// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import test from "ava";

import { Errors, ErrorList, ValidateError } from "./errors";

test("Errors object should have correct properties", t => {
  t.deepEqual(Errors, {
    audit: "audit",
    ignore: "ignore",
    reject: "reject",
  });
});

test("ErrorList should contain correct values", t => {
  t.deepEqual(ErrorList, ["audit", "ignore", "reject"]);
});

test("ValidateError should not throw an error for valid errors", t => {
  t.notThrows(() => {
    ValidateError("audit");
    ValidateError("ignore");
    ValidateError("reject");
  });
});

test("ValidateError should throw an error for invalid errors", t => {
  t.throws(() => ValidateError("invalidError"), {
    message: "Invalid error: invalidError. Must be one of: audit, ignore, reject",
  });
});
