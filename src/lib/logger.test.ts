// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeEach, describe, expect, it, jest } from "@jest/globals";

describe("Logger", () => {
  beforeEach(() => {
    jest.resetModules(); // Clear the cache for modules
    process.env = {}; // Clear environment variables
  });

  it("should set log level based on LOG_LEVEL environment variable", async () => {
    process.env.LOG_LEVEL = "debug";
    const { default: logger } = await import("./logger");

    expect(logger.level).toBe("debug");
  });
});
