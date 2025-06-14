// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { vi, describe, it, expect, beforeEach } from "vitest";
import { formatWithPrettier } from "./format.helpers";
import { promises as fs } from "fs";
import { resolveConfig, format } from "prettier";
import { ESLint } from "eslint";

vi.mock("fs", () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
}));

vi.mock("prettier", () => ({
  resolveConfig: vi.fn(),
  format: vi.fn(),
}));

describe("formatWithPrettier", () => {
  const mockReadFile = vi.mocked(fs.readFile);
  const mockWriteFile = vi.mocked(fs.writeFile);
  const mockResolveConfig = vi.mocked(resolveConfig);
  const mockFormat = vi.mocked(format);

  const mockResults: ESLint.LintResult[] = [
    { filePath: "package.json" } as ESLint.LintResult,
    { filePath: "hello-pepr.ts" } as ESLint.LintResult,
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should format files and write back to the file system", async () => {
    mockReadFile.mockResolvedValue("const x =1;");
    mockResolveConfig.mockResolvedValue({ semi: true });
    mockFormat.mockResolvedValue("const x = 1;");

    const validateOnly = false;

    const result = await formatWithPrettier(mockResults, validateOnly);

    expect(result).toBe(false);
    expect(mockReadFile).toHaveBeenCalledTimes(2);
    expect(mockWriteFile).toHaveBeenCalledTimes(2);
    expect(mockFormat).toHaveBeenCalledTimes(2);

    expect(mockWriteFile).toHaveBeenCalledWith("package.json", "const x = 1;");
    expect(mockWriteFile).toHaveBeenCalledWith("hello-pepr.ts", "const x = 1;");
  });

  it("should report failures in validate-only mode if files are not formatted", async () => {
    mockReadFile.mockResolvedValue("const x =1;");
    mockResolveConfig.mockResolvedValue({ semi: true });
    mockFormat.mockResolvedValue("const x = 1;");

    const validateOnly = true;

    const mockError = vi.spyOn(console, "error").mockImplementation(() => {
      return undefined as never;
    });
    const result = await formatWithPrettier(mockResults, validateOnly);

    expect(result).toBe(true);
    expect(mockReadFile).toHaveBeenCalledTimes(2);
    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(mockError).toHaveBeenCalledWith("File package.json is not formatted correctly");
    expect(mockError).toHaveBeenCalledWith("File hello-pepr.ts is not formatted correctly");

    mockError.mockRestore();
  });
});
