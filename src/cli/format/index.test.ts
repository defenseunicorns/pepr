// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { vi, describe, it, expect, beforeEach } from "vitest";
import { peprFormat } from "./index";
import { formatWithPrettier } from "./format.helpers";
import { ESLint } from "eslint";
import Log from "../../lib/telemetry/logger";

// Mock ESLint
vi.mock("eslint", () => {
  return {
    ESLint: vi.fn(() => ({
      lintFiles: vi.fn(),
      loadFormatter: vi.fn(),
    })),
  };
});

// Mock formatWithPrettier
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
  const mockLintFiles = vi.fn();
  const mockLoadFormatter = vi.fn();
  const mockOutputFixes = vi.fn();
  const mockFormatFn = vi.fn();
  const mockFormatWithPrettier = vi.mocked(formatWithPrettier);

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup ESLint mock implementation
    (ESLint as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      lintFiles: mockLintFiles,
      loadFormatter: mockLoadFormatter,
    }));

    // Mock static method
    ESLint.outputFixes = mockOutputFixes;

    // Setup formatter mock
    mockLoadFormatter.mockResolvedValue({
      format: mockFormatFn,
    });
  });

  it("should return true when there are no linting errors and formatting succeeds", async () => {
    // Setup mock results with no errors
    const mockResults = [
      { filePath: "file1.ts", errorCount: 0, fatalErrorCount: 0 },
      { filePath: "file2.ts", errorCount: 0, fatalErrorCount: 0 },
    ];

    mockLintFiles.mockResolvedValue(mockResults);
    mockFormatFn.mockResolvedValue(""); // No output means no errors
    mockFormatWithPrettier.mockResolvedValue(false); // No formatting errors

    const result = await peprFormat(false);

    expect(result).toBe(true);
    expect(mockOutputFixes).toHaveBeenCalledWith(mockResults);
    expect(mockFormatWithPrettier).toHaveBeenCalledWith(mockResults, false);
    expect(process.exitCode).not.toBe(1);
  });

  it("should return false when there are only linting errors", async () => {
    // Setup mock results with errors
    const mockResults = [
      { filePath: "file1.ts", errorCount: 2, fatalErrorCount: 0 },
      { filePath: "file2.ts", errorCount: 0, fatalErrorCount: 0 },
    ];

    mockLintFiles.mockResolvedValue(mockResults);
    mockFormatFn.mockResolvedValue("Some linting errors"); // Output indicates errors
    mockFormatWithPrettier.mockResolvedValue(false); // No formatting errors

    const result = await peprFormat(false);

    expect(result).toBe(false);
    expect(Log.info).toHaveBeenCalledWith("Some linting errors");
  });

  it("should return false when there are only formatting errors", async () => {
    // Setup mock results with no linting errors but formatting errors
    const mockResults = [
      { filePath: "file1.ts", errorCount: 0, fatalErrorCount: 0 },
      { filePath: "file2.ts", errorCount: 0, fatalErrorCount: 0 },
    ];

    mockLintFiles.mockResolvedValue(mockResults);
    mockFormatFn.mockResolvedValue("");
    mockFormatWithPrettier.mockResolvedValue(true); // Formatting errors

    const result = await peprFormat(false);

    expect(result).toBe(false);
    expect(mockFormatWithPrettier).toHaveBeenCalledWith(mockResults, false);
  });

  it("should log an error when an exception occurs", async () => {
    const mockError = new Error("Mock error");
    mockLintFiles.mockRejectedValue(mockError);
    const result = await peprFormat(false);

    expect(result).toBe(false);
    expect(Log.error).toHaveBeenCalledWith(mockError, "Error formatting module:");
  });
});
