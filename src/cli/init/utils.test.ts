// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, test } from "@jest/globals";

import { sanitizeName } from "./utils";

test("sanitizeName() sanitizes names correctly", () => {
  const cases = [
    {
      input: "My Test Module",
      expected: "my-test-module",
    },
    {
      input: "!! 123 @@ Module",
      expected: "123-module",
    },
    {
      input: "---Test-Module---",
      expected: "test-module",
    },
  ];

  for (const { input, expected } of cases) {
    const result = sanitizeName(input);
    expect(result).toBe(expected);
  }
});
