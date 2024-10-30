// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { determineRbacMode } from "./build";

import { expect, describe, test } from "@jest/globals";

describe("determineRbacMode", () => {
  test("should allow CLI options to overwrite module config", () => {
    const opts = { rbacMode: "admin" };
    const cfg = { pepr: { rbacMode: "scoped" } };
    const result = determineRbacMode(opts, cfg);
    expect(result).toBe("admin");
  });

  test('should return "admin" when cfg.pepr.rbacMode is provided and not "scoped"', () => {
    const opts = {};
    const cfg = { pepr: { rbacMode: "admin" } };
    const result = determineRbacMode(opts, cfg);
    expect(result).toBe("admin");
  });

  test('should return "scoped" when cfg.pepr.rbacMode is "scoped"', () => {
    const opts = {};
    const cfg = { pepr: { rbacMode: "scoped" } };
    const result = determineRbacMode(opts, cfg);
    expect(result).toBe("scoped");
  });

  test("should default to admin when neither option is provided", () => {
    const opts = {};
    const cfg = { pepr: {} };
    const result = determineRbacMode(opts, cfg);
    expect(result).toBe("admin");
  });
});
