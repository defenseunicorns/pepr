// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Kubernetes Fluent Client Authors

import * as fs from "fs";
import { NodeFileSystem } from "./fileSystem";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";

// Mock the fs module
jest.mock("fs");

describe("NodeFileSystem", () => {
  let nodeFileSystem: NodeFileSystem;

  beforeEach(() => {
    nodeFileSystem = new NodeFileSystem();
    jest.clearAllMocks(); // Clear all mocks before each test
  });

  describe("readFile", () => {
    test("should call fs.readFileSync with correct arguments", () => {
      const mockFilePath = "test-file.txt";
      const mockFileContent = "This is a test file";

      // Mock the fs.readFileSync method to return the mock file content
      (fs.readFileSync as jest.Mock).mockReturnValue(mockFileContent);

      const result = nodeFileSystem.readFile(mockFilePath);

      // Assert that fs.readFileSync was called with the correct file path and encoding
      expect(fs.readFileSync).toHaveBeenCalledWith(mockFilePath, "utf8");

      // Assert that the returned content matches the mock file content
      expect(result).toBe(mockFileContent);
    });
  });

  describe("writeFile", () => {
    test("should call fs.writeFileSync with correct arguments", () => {
      const mockFilePath = "test-file.txt";
      const mockFileContent = "This is a test file";

      // Call the writeFile method
      nodeFileSystem.writeFile(mockFilePath, mockFileContent);

      // Assert that fs.writeFileSync was called with the correct arguments
      expect(fs.writeFileSync).toHaveBeenCalledWith(mockFilePath, mockFileContent, "utf8");
    });
  });

  describe("readdirSync", () => {
    test("should call fs.readdirSync with correct arguments and return file list", () => {
      const mockDirectoryPath = "test-directory";
      const mockFileList = ["file1.txt", "file2.txt"];

      // Mock the fs.readdirSync method to return the mock file list
      (fs.readdirSync as jest.Mock).mockReturnValue(mockFileList);

      const result = nodeFileSystem.readdirSync(mockDirectoryPath);

      // Assert that fs.readdirSync was called with the correct directory path
      expect(fs.readdirSync).toHaveBeenCalledWith(mockDirectoryPath);

      // Assert that the returned file list matches the mock file list
      expect(result).toEqual(mockFileList);
    });
  });
});
