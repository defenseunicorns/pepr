// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { vi, describe, it, expect, beforeEach } from "vitest";
import { peprFormat } from "./index";
import { formatWithPrettier } from "./format.helpers";
import Log from "../../lib/telemetry/logger";

const h = vi.hoisted(() => ({
  mockLintFiles: vi.fn(),
  mockLoadFormatter: vi.fn(),
  mockOutputFixes: vi.fn(),
  mockFormatFn: vi.fn(),
}));

vi.mock("eslint", () => {
  class MockESLint {
    constructor() {}
    lintFiles = h.mockLintFiles;
    loadFormatter = h.mockLoadFormatter;
    static outputFixes = h.mockOutputFixes;
  }
  return { ESLint: MockESLint };
});

vi.mock("./format.helpers", () => ({
  formatWithPrettier: vi.fn(),
}));

vi.mock("../../lib/telemetry/logger", () => ({
  __esModule: true,
  default: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Pepr Format", () => {
  const mockFormatWithPrettier = vi.mocked(formatWithPrettier);

  beforeEach(() => {
    vi.clearAllMocks();
    h.mockLoadFormatter.mockResolvedValue({ format: h.mockFormatFn });
  });

  it("should return true when there are no linting errors and formatting succeeds", async () => {
    const mockResults = [
      { filePath: "file1.ts", errorCount: 0, fatalErrorCount: 0 },
      { filePath: "file2.ts", errorCount: 0, fatalErrorCount: 0 },
    ];

    h.mockLintFiles.mockResolvedValue(mockResults);
    h.mockFormatFn.mockResolvedValue("");
    mockFormatWithPrettier.mockResolvedValue(false);

    const result = await peprFormat(false);

    expect(result).toBe(true);
    expect(h.mockOutputFixes).toHaveBeenCalledWith(mockResults);
    expect(mockFormatWithPrettier).toHaveBeenCalledWith(mockResults, false);
    expect(process.exitCode).not.toBe(1);
  });

  it("should return false when there are only linting errors", async () => {
    const mockResults = [
      { filePath: "file1.ts", errorCount: 2, fatalErrorCount: 0 },
      { filePath: "file2.ts", errorCount: 0, fatalErrorCount: 0 },
    ];

    h.mockLintFiles.mockResolvedValue(mockResults);
    h.mockFormatFn.mockResolvedValue("Some linting errors");
    mockFormatWithPrettier.mockResolvedValue(false);

    const result = await peprFormat(false);

    expect(result).toBe(false);
    expect(Log.info).toHaveBeenCalledWith("Some linting errors");
  });

  it("should return false when there are only formatting errors", async () => {
    const mockResults = [
      { filePath: "file1.ts", errorCount: 0, fatalErrorCount: 0 },
      { filePath: "file2.ts", errorCount: 0, fatalErrorCount: 0 },
    ];

    h.mockLintFiles.mockResolvedValue(mockResults);
    h.mockFormatFn.mockResolvedValue("");
    mockFormatWithPrettier.mockResolvedValue(true);

    const result = await peprFormat(false);

    expect(result).toBe(false);
    expect(mockFormatWithPrettier).toHaveBeenCalledWith(mockResults, false);
  });

  it("should log an error when an exception occurs", async () => {
    const mockError = new Error("Mock error");
    h.mockLintFiles.mockRejectedValue(mockError);

    const result = await peprFormat(false);

    expect(result).toBe(false);
    expect(Log.error).toHaveBeenCalledWith(mockError, "Error formatting module:");
  });
});
