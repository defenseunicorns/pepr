// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { formatWithPrettier } from "./format.helpers";
import { promises as fs } from "fs";
import { resolveConfig, format } from "prettier";
import { ESLint } from "eslint";

jest.mock("fs", () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
}));

jest.mock("prettier", () => ({
  resolveConfig: jest.fn(),
  format: jest.fn(),
}));

describe("formatWithPrettier", () => {
  const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
  const mockWriteFile = fs.writeFile as jest.MockedFunction<typeof fs.writeFile>;
  const mockResolveConfig = resolveConfig as jest.MockedFunction<typeof resolveConfig>;
  const mockFormat = format as jest.MockedFunction<typeof format>;

  const mockResults: ESLint.LintResult[] = [
    { filePath: "package.json" } as ESLint.LintResult,
    { filePath: "hello-pepr.ts" } as ESLint.LintResult,
  ];

  beforeEach(() => {
    jest.clearAllMocks();
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

    const mockError = jest.spyOn(console, "error").mockImplementation(() => {
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
