"use strict";
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Kubernetes Fluent Client Authors
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const fileSystem_1 = require("./fileSystem");
const globals_1 = require("@jest/globals");
// Mock the fs module
globals_1.jest.mock("fs");
(0, globals_1.describe)("NodeFileSystem", () => {
    let nodeFileSystem;
    (0, globals_1.beforeEach)(() => {
        nodeFileSystem = new fileSystem_1.NodeFileSystem();
        globals_1.jest.clearAllMocks(); // Clear all mocks before each test
    });
    (0, globals_1.describe)("readFile", () => {
        (0, globals_1.test)("should call fs.readFileSync with correct arguments", () => {
            const mockFilePath = "test-file.txt";
            const mockFileContent = "This is a test file";
            // Mock the fs.readFileSync method to return the mock file content
            fs.readFileSync.mockReturnValue(mockFileContent);
            const result = nodeFileSystem.readFile(mockFilePath);
            // Assert that fs.readFileSync was called with the correct file path and encoding
            (0, globals_1.expect)(fs.readFileSync).toHaveBeenCalledWith(mockFilePath, "utf8");
            // Assert that the returned content matches the mock file content
            (0, globals_1.expect)(result).toBe(mockFileContent);
        });
    });
    (0, globals_1.describe)("writeFile", () => {
        (0, globals_1.test)("should call fs.writeFileSync with correct arguments", () => {
            const mockFilePath = "test-file.txt";
            const mockFileContent = "This is a test file";
            // Call the writeFile method
            nodeFileSystem.writeFile(mockFilePath, mockFileContent);
            // Assert that fs.writeFileSync was called with the correct arguments
            (0, globals_1.expect)(fs.writeFileSync).toHaveBeenCalledWith(mockFilePath, mockFileContent, "utf8");
        });
    });
    (0, globals_1.describe)("readdirSync", () => {
        (0, globals_1.test)("should call fs.readdirSync with correct arguments and return file list", () => {
            const mockDirectoryPath = "test-directory";
            const mockFileList = ["file1.txt", "file2.txt"];
            // Mock the fs.readdirSync method to return the mock file list
            fs.readdirSync.mockReturnValue(mockFileList);
            const result = nodeFileSystem.readdirSync(mockDirectoryPath);
            // Assert that fs.readdirSync was called with the correct directory path
            (0, globals_1.expect)(fs.readdirSync).toHaveBeenCalledWith(mockDirectoryPath);
            // Assert that the returned file list matches the mock file list
            (0, globals_1.expect)(result).toEqual(mockFileList);
        });
    });
});
