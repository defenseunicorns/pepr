// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, it } from "@jest/globals";

import { sanitizeName } from "./utils";

it.each([
  //Test sanitizeName() with ["$BAD_INPUT", "$SANITIZED_INPUT"]
  ["My Test Module", "my-test-module"],
  ["!! 123 @@ Module", "123-module"],
  ["---Test-Module---", "test-module"],
])("sanitizeName() sanitizes '%s' correctly", (input: string, expected: string) => {
  expect(sanitizeName(input)).toBe(expected);
});

it("sanitizeName() should throw TypeError when given a non-string", () => {
  expect(() => sanitizeName({ input: 0 } as unknown as string)).toThrow(TypeError);
});
