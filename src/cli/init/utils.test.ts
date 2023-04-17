// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import test from "ava";
import { sanitizeName } from "./utils";

test("sanitizeName() sanitizes names correctly", t => {
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
    t.is(result, expected, `sanitizeName(${input}) should be ${expected}`);
  }
});
