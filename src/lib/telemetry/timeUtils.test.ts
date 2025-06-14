// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { describe, expect, it } from "vitest";
import { getNow } from "./timeUtils";
describe("getNow", () => {
  it("should return the current time in milliseconds", () => {
    const perfNow = getNow();
    const performanceNow = performance.now();

    expect(performanceNow).toBeGreaterThanOrEqual(perfNow);
  });
});
