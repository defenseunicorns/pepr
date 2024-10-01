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
const postProcessingModule = __importStar(require("./postProcessing"));
const fileSystem_1 = require("./fileSystem");
const globals_1 = require("@jest/globals");
const fs = __importStar(require("fs")); // We'll mock fs
// Mock fs
globals_1.jest.mock("fs");
// Mock path.join
globals_1.jest.mock("path", () => ({
    join: (...args) => args.join("/"), // Simulates path.join behavior
}));
// Mock NodeFileSystem methods
globals_1.jest.mock("./fileSystem", () => ({
    NodeFileSystem: globals_1.jest.fn().mockImplementation(() => ({
        readdirSync: globals_1.jest.fn(),
        readFile: globals_1.jest.fn(),
        writeFile: globals_1.jest.fn(),
    })),
}));
globals_1.jest.mock("./types", () => ({
    GenericKind: globals_1.jest.fn().mockImplementation(() => ({
        kind: "MockKind",
        apiVersion: "v1",
    })),
}));
globals_1.jest.mock("./postProcessing", () => {
    const originalModule = globals_1.jest.requireActual("./postProcessing");
    return {
        ...(typeof originalModule === "object" ? originalModule : {}),
        processAndModifySingleFile: globals_1.jest.fn(), // Mock the specific function
        mapFilesToCRD: globals_1.jest.fn(), // Mock mapFilesToCRD to avoid conflict
    };
});
const mockFileSystem = new fileSystem_1.NodeFileSystem();
const mockCRDResults = [
    {
        name: "TestKind",
        crd: {
            spec: {
                group: "test.group",
                names: { kind: "TestKind", plural: "TestKinds" },
                scope: "Namespaced",
                versions: [{ name: "v1", served: true, storage: true }],
            },
        },
        version: "v1",
    },
];
// Define the mock data
/* const mockLines = ["line1", "line2"];
const mockName = "TestKind";
const mockCRD: CustomResourceDefinition = {
  spec: {
    group: "test.group",
    names: { kind: "TestKind", plural: "testkinds" },
    scope: "Namespaced",
    versions: [{ name: "v1", served: true, storage: true }],
  },
};
const mockVersion = "v1"; */
const mockOpts = {
    directory: "mockDir",
    logFn: globals_1.jest.fn(), // Mock logging function
    language: "ts",
    plain: false,
    npmPackage: "mockPackage",
    source: "",
};
(0, globals_1.describe)("postProcessing", () => {
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks(); // Clear mocks before each test
    });
    (0, globals_1.afterEach)(() => {
        globals_1.jest.restoreAllMocks(); // Restore all mocks after each test
    });
    (0, globals_1.test)("should log error when directory is not defined", async () => {
        const optsWithoutDirectory = { ...mockOpts, directory: undefined };
        await postProcessingModule.postProcessing(mockCRDResults, optsWithoutDirectory, mockFileSystem);
        (0, globals_1.expect)(mockOpts.logFn).toHaveBeenCalledWith("⚠️ Error: Directory is not defined.");
    });
    (0, globals_1.test)("should read files from directory and process them", async () => {
        const mockFileResultMap = { "TestKind-v1.ts": mockCRDResults[0] };
        globals_1.jest.spyOn(mockFileSystem, "readFile").mockReturnValue("mock content");
        globals_1.jest.spyOn(mockFileSystem, "writeFile");
        await postProcessingModule.processFiles(["TestKind-v1.ts"], mockFileResultMap, mockOpts, mockFileSystem);
        (0, globals_1.expect)(mockFileSystem.readFile).toHaveBeenCalledWith("mockDir/TestKind-v1.ts");
        (0, globals_1.expect)(mockFileSystem.writeFile).toHaveBeenCalled();
    });
    (0, globals_1.test)("should log error when failing to read the file", async () => {
        // Mock a situation where the file exists but reading it fails
        const mockFileResultMap = { "TestKind-v1.ts": mockCRDResults[0] };
        // Simulate readFile throwing an error
        globals_1.jest.spyOn(mockFileSystem, "readFile").mockImplementation(() => {
            throw new Error("File read error");
        });
        await postProcessingModule.processFiles(["TestKind-v1.ts"], mockFileResultMap, mockOpts, mockFileSystem);
        // Verify the error log
        (0, globals_1.expect)(mockOpts.logFn).toHaveBeenCalledWith("❌ Error processing file: mockDir/TestKind-v1.ts - File read error");
    });
    (0, globals_1.test)("should log start and completion messages", async () => {
        globals_1.jest.spyOn(mockFileSystem, "readdirSync").mockReturnValue(["TestKind-v1.ts"]);
        globals_1.jest
            .spyOn(postProcessingModule, "mapFilesToCRD")
            .mockReturnValue({ "TestKind-v1.ts": mockCRDResults[0] });
        //jest.spyOn(postProcessingModule, "processFiles").mockImplementation(() => Promise.resolve());
        await postProcessingModule.postProcessing(mockCRDResults, mockOpts, mockFileSystem);
        // Verify the start message was logged
        (0, globals_1.expect)(mockOpts.logFn).toHaveBeenCalledWith("\n🔧 Post-processing started...");
        // Verify the completion message was logged
        (0, globals_1.expect)(mockOpts.logFn).toHaveBeenCalledWith("🔧 Post-processing completed.\n");
    });
    (0, globals_1.test)("should handle readdirSync error gracefully", async () => {
        // Simulate an error when reading the directory
        globals_1.jest.spyOn(mockFileSystem, "readdirSync").mockImplementation(() => {
            throw new Error("Directory read error");
        });
        await (0, globals_1.expect)(postProcessingModule.postProcessing(mockCRDResults, mockOpts, mockFileSystem)).rejects.toThrow("Directory read error");
        // Ensure the process is not continued after the error
        (0, globals_1.expect)(mockOpts.logFn).not.toHaveBeenCalledWith("🔧 Post-processing completed.\n");
    });
});
(0, globals_1.describe)("mapFilesToCRD", () => {
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks(); // Clear mocks before each test
    });
    (0, globals_1.afterEach)(() => {
        globals_1.jest.restoreAllMocks(); // Restore all mocks after each test
    });
    (0, globals_1.test)("should map files to corresponding CRD results", () => {
        const result = postProcessingModule.mapFilesToCRD(mockCRDResults);
        (0, globals_1.expect)(result).toEqual({
            "TestKind-v1.ts": mockCRDResults[0],
        });
    });
    (0, globals_1.test)("should log a warning if no matching CRD result found for a file", async () => {
        const mockFiles = ["NonExistingKind.ts"];
        const mockFileResultMap = {};
        await postProcessingModule.processFiles(mockFiles, mockFileResultMap, mockOpts, mockFileSystem);
        (0, globals_1.expect)(mockOpts.logFn).toHaveBeenCalledWith("⚠️ Warning: No matching CRD result found for file: mockDir/NonExistingKind.ts");
    });
});
(0, globals_1.describe)("applyCRDPostProcessing", () => {
    const mockContent = "mock content";
    const mockOpts = {
        directory: "mockDir",
        logFn: globals_1.jest.fn(),
        language: "ts",
        plain: false,
        npmPackage: "mockPackage",
        source: "",
    };
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks(); // Clear mocks before each test
    });
    (0, globals_1.afterEach)(() => {
        globals_1.jest.restoreAllMocks(); // Restore all mocks after each test
    });
    (0, globals_1.test)("should process TypeScript file content", () => {
        const result = postProcessingModule.applyCRDPostProcessing(mockContent, "TestKind", mockCRDResults[0].crd, "v1", mockOpts);
        (0, globals_1.expect)(result).toContain("mock content");
        // Add more assertions based on what is expected after processing
    });
    (0, globals_1.test)("should process TypeScript file content", () => {
        const result = postProcessingModule.applyCRDPostProcessing(mockContent, "TestKind", mockCRDResults[0].crd, "v1", mockOpts);
        (0, globals_1.expect)(result).toContain("mock content");
        // Add more assertions based on what is expected after processing
    });
});
(0, globals_1.describe)("processFiles", () => {
    const mockOptsWithoutDirectory = { ...mockOpts, directory: undefined };
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks(); // Clear mocks before each test
    });
    (0, globals_1.afterEach)(() => {
        globals_1.jest.restoreAllMocks(); // Restore all mocks after each test
    });
    (0, globals_1.test)("should process files in directory", async () => {
        const mockFileResultMap = { "TestKind-v1.ts": mockCRDResults[0] };
        globals_1.jest.spyOn(mockFileSystem, "readFile").mockReturnValue("mock content");
        globals_1.jest.spyOn(mockFileSystem, "writeFile");
        await postProcessingModule.processFiles(["TestKind-v1.ts"], mockFileResultMap, mockOpts, mockFileSystem);
        (0, globals_1.expect)(mockFileSystem.readFile).toHaveBeenCalledWith("mockDir/TestKind-v1.ts");
        (0, globals_1.expect)(mockFileSystem.writeFile).toHaveBeenCalled();
    });
    (0, globals_1.test)("should throw an error if directory is not defined", async () => {
        const mockFiles = ["TestKind-v1.ts"];
        const mockFileResultMap = { "TestKind-v1.ts": mockCRDResults[0] };
        await (0, globals_1.expect)(postProcessingModule.processFiles(mockFiles, mockFileResultMap, mockOptsWithoutDirectory, mockFileSystem)).rejects.toThrow("Directory is not defined");
    });
});
(0, globals_1.describe)("wrapWithFluentClient", () => {
    /*   const mockLines = ["line1", "line2"];
    const mockName = "TestKind";
    const mockCRD = {
      spec: {
        group: "test.group",
        names: { kind: "TestKind", plural: "testkinds" },
        scope: "Namespaced",
        versions: [{ name: "v1", served: true, storage: true }],
      },
    };
    const mockVersion = "v1";
    const mockOpts = {
      directory: "mockDir",
      logFn: jest.fn(),
      language: "ts",
      plain: false,
      npmPackage: "mockPackage",
      source: "",
    }; */
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks(); // Clear mocks before each test
    });
    (0, globals_1.test)("should replace interface declaration with class extending GenericKind", () => {
        const inputLines = ["export interface TestKind {", "  prop: string;", "}"];
        const crd = {
            spec: {
                group: "test.group",
                names: { plural: "testkinds" },
            },
        }; // mock the CRD
        const expectedOutputLines = [
            "// This file is auto-generated by mockPackage, do not edit manually",
            'import { GenericKind, RegisterKind } from "mockPackage";',
            "export class TestKind extends GenericKind {",
            "  prop: string;",
            "}",
            "RegisterKind(TestKind, {",
            '  group: "test.group",',
            '  version: "v1",',
            '  kind: "TestKind",',
            '  plural: "testkinds",',
            "});",
        ];
        const result = postProcessingModule.wrapWithFluentClient(inputLines, "TestKind", crd, "v1", "mockPackage");
        (0, globals_1.expect)(result).toEqual(expectedOutputLines);
    });
});
(0, globals_1.describe)("getGenericKindProperties", () => {
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks(); // Clear mocks before each test
    });
    (0, globals_1.afterEach)(() => {
        globals_1.jest.restoreAllMocks(); // Restore all mocks after each test
    });
    (0, globals_1.test)("should retrieve properties from GenericKind", () => {
        const result = postProcessingModule.getGenericKindProperties();
        (0, globals_1.expect)(result).toContain("kind");
        (0, globals_1.expect)(result).toContain("apiVersion");
        (0, globals_1.expect)(result).not.toContain("[key: string]");
    });
});
(0, globals_1.describe)("processLines", () => {
    const mockLines = ["export class TestKind extends GenericKind {", "  kind: string;", "}"];
    const mockFoundInterfaces = new Set(["TestKind"]);
    const mockGenericKindProperties = ["kind", "apiVersion"];
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks(); // Clear mocks before each test
    });
    (0, globals_1.afterEach)(() => {
        globals_1.jest.restoreAllMocks(); // Restore all mocks after each test
    });
    (0, globals_1.test)("should process lines and modify properties of classes extending GenericKind", () => {
        const result = postProcessingModule.processLines(mockLines, mockGenericKindProperties, mockFoundInterfaces);
        (0, globals_1.expect)(result).toContain("  declare kind: string;");
    });
});
(0, globals_1.describe)("processClassContext", () => {
    const mockGenericKindProperties = ["kind"];
    const mockFoundInterfaces = new Set();
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks(); // Clear mocks before each test
    });
    (0, globals_1.afterEach)(() => {
        globals_1.jest.restoreAllMocks(); // Restore all mocks after each test
    });
    (0, globals_1.test)("should detect class extending GenericKind and modify context", () => {
        const line = "export class TestKind extends GenericKind {";
        const result = postProcessingModule.processClassContext(line, false, 0, mockGenericKindProperties, mockFoundInterfaces);
        (0, globals_1.expect)(result.insideClass).toBe(true);
        (0, globals_1.expect)(result.braceBalance).toBe(1);
    });
    (0, globals_1.test)("should update brace balance when closing braces are found", () => {
        const line = "}";
        const result = postProcessingModule.processClassContext(line, true, 1, mockGenericKindProperties, mockFoundInterfaces);
        (0, globals_1.expect)(result.insideClass).toBe(false);
        (0, globals_1.expect)(result.braceBalance).toBe(0);
    });
});
(0, globals_1.describe)("normalizeIndentationAndSpacing", () => {
    const mockOpts = {
        language: "ts",
        source: "",
        logFn: globals_1.jest.fn(),
    };
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks(); // Clear mocks before each test
    });
    (0, globals_1.afterEach)(() => {
        globals_1.jest.restoreAllMocks(); // Restore all mocks after each test
    });
    (0, globals_1.test)("should normalize indentation to two spaces", () => {
        const mockLines = [
            "    indentedWithFourSpaces: string;", // Line with 4 spaces, should be normalized
            "  alreadyTwoSpaces: string;", // Line with 2 spaces, should remain unchanged
            "      sixSpacesIndent: string;", // Line with 6 spaces, only first 4 should be normalized
            "noIndent: string;", // Line with no indentation, should remain unchanged
        ];
        const expectedResult = [
            "  indentedWithFourSpaces: string;", // Normalized to 2 spaces
            "  alreadyTwoSpaces: string;", // No change
            "    sixSpacesIndent: string;", // Only first 4 spaces should be normalized to 2
            "noIndent: string;", // No change
        ];
        const result = postProcessingModule.normalizeIndentation(mockLines);
        (0, globals_1.expect)(result).toEqual(expectedResult);
    });
    (0, globals_1.test)("should normalize single line indentation to two spaces", () => {
        const cases = [
            { input: "    indentedWithFourSpaces;", expected: "  indentedWithFourSpaces;" }, // 4 spaces to 2 spaces
            { input: "  alreadyTwoSpaces;", expected: "  alreadyTwoSpaces;" }, // 2 spaces, no change
            { input: "      sixSpacesIndent;", expected: "    sixSpacesIndent;" }, // First 4 spaces to 2
            { input: "noIndent;", expected: "noIndent;" }, // No indentation, no change
        ];
        cases.forEach(({ input, expected }) => {
            const result = postProcessingModule.normalizeLineIndentation(input);
            (0, globals_1.expect)(result).toBe(expected);
        });
    });
    (0, globals_1.test)("should normalize property spacing", () => {
        const cases = [
            {
                input: "optionalProp  ? : string;",
                expected: "optionalProp?: string;",
            }, // Extra spaces around ? and :
            {
                input: "optionalProp?: string;",
                expected: "optionalProp?: string;",
            }, // Already normalized
            {
                input: "optionalProp ? :string;",
                expected: "optionalProp?: string;",
            }, // No space after colon
            {
                input: "nonOptionalProp: string;",
                expected: "nonOptionalProp: string;",
            }, // Non-optional property, should remain unchanged
        ];
        const inputLines = cases.map(c => c.input);
        const expectedLines = cases.map(c => c.expected);
        const result = postProcessingModule.normalizePropertySpacing(inputLines);
        (0, globals_1.expect)(result).toEqual(expectedLines);
    });
    (0, globals_1.test)('should remove lines containing "[property: string]: any;" when language is "ts" or "typescript"', () => {
        const inputLines = [
            "someProp: string;",
            "[property: string]: any;",
            "anotherProp: number;",
            "[property: string]: any;",
        ];
        // Test for TypeScript
        const tsOpts = { ...mockOpts, language: "ts" };
        const resultTs = postProcessingModule.removePropertyStringAny(inputLines, tsOpts);
        const expectedTs = ["someProp: string;", "anotherProp: number;"];
        (0, globals_1.expect)(resultTs).toEqual(expectedTs);
        // Test for TypeScript with "typescript" as language
        const typescriptOpts = { ...mockOpts, language: "typescript" };
        const resultTypescript = postProcessingModule.removePropertyStringAny(inputLines, typescriptOpts);
        (0, globals_1.expect)(resultTypescript).toEqual(expectedTs);
    });
    (0, globals_1.describe)("processEslintDisable", () => {
        (0, globals_1.beforeEach)(() => {
            globals_1.jest.clearAllMocks(); // Clear mocks before each test
        });
        (0, globals_1.afterEach)(() => {
            globals_1.jest.restoreAllMocks(); // Restore all mocks after each test
        });
        (0, globals_1.test)('should add ESLint disable comment if line contains "[key: string]: any" and is not part of genericKindProperties', () => {
            const line = "[key: string]: any;";
            const genericKindProperties = ["kind", "apiVersion"]; // No "[key: string]" present
            const result = postProcessingModule.processEslintDisable(line, genericKindProperties);
            (0, globals_1.expect)(result).toEqual("  // eslint-disable-next-line @typescript-eslint/no-explicit-any\n[key: string]: any;");
        });
        (0, globals_1.test)('should not add ESLint disable comment if "[key: string]" is in genericKindProperties', () => {
            const line = "[key: string]: any;";
            const genericKindProperties = ["[key: string]", "kind", "apiVersion"]; // "[key: string]" present
            const result = postProcessingModule.processEslintDisable(line, genericKindProperties);
            (0, globals_1.expect)(result).toEqual("[key: string]: any;"); // No comment added
        });
        (0, globals_1.test)('should not add ESLint disable comment if line does not contain "[key: string]: any"', () => {
            const line = "prop: string;";
            const genericKindProperties = ["kind", "apiVersion"]; // Normal properties
            const result = postProcessingModule.processEslintDisable(line, genericKindProperties);
            (0, globals_1.expect)(result).toEqual("prop: string;"); // No change in the line
        });
        (0, globals_1.test)('should not add ESLint disable comment if line contains "[key: string]: any" but is part of genericKindProperties', () => {
            const line = "[key: string]: any;";
            const genericKindProperties = ["[key: string]"];
            const result = postProcessingModule.processEslintDisable(line, genericKindProperties);
            (0, globals_1.expect)(result).toEqual("[key: string]: any;"); // No comment added since it's in genericKindProperties
        });
    });
    (0, globals_1.test)('should not remove lines when language is not "ts" or "typescript"', () => {
        const inputLines = ["someProp: string;", "[property: string]: any;", "anotherProp: number;"];
        // Test for other languages
        const otherOpts = { ...mockOpts, language: "js" }; // Not TypeScript
        const resultOther = postProcessingModule.removePropertyStringAny(inputLines, otherOpts);
        (0, globals_1.expect)(resultOther).toEqual(inputLines); // Should return the original lines
    });
});
(0, globals_1.describe)("makePropertiesOptional", () => {
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks(); // Clear mocks before each test
    });
    (0, globals_1.afterEach)(() => {
        globals_1.jest.restoreAllMocks(); // Restore all mocks after each test
    });
    (0, globals_1.test)("should make property optional if type is found in interfaces and not already optional", () => {
        const line = "myProp: MyInterface;";
        const foundInterfaces = new Set(["MyInterface"]); // Matching interface
        const result = postProcessingModule.makePropertiesOptional(line, foundInterfaces);
        (0, globals_1.expect)(result).toEqual("myProp?: MyInterface;"); // The colon is replaced by `?:`
    });
    (0, globals_1.test)("should not make property optional if type is not found in interfaces", () => {
        const line = "myProp: AnotherType;";
        const foundInterfaces = new Set(["MyInterface"]); // No match for this type
        const result = postProcessingModule.makePropertiesOptional(line, foundInterfaces);
        (0, globals_1.expect)(result).toEqual("myProp: AnotherType;"); // No change
    });
    (0, globals_1.test)("should not make property optional if already optional", () => {
        const line = "myProp?: MyInterface;";
        const foundInterfaces = new Set(["MyInterface"]); // Matching interface, but already optional
        const result = postProcessingModule.makePropertiesOptional(line, foundInterfaces);
        (0, globals_1.expect)(result).toEqual("myProp?: MyInterface;"); // No change since it's already optional
    });
    (0, globals_1.test)("should not change line if it does not match the property pattern", () => {
        const line = "function test() {}";
        const foundInterfaces = new Set(["MyInterface"]); // Matching interface, but the line is not a property
        const result = postProcessingModule.makePropertiesOptional(line, foundInterfaces);
        (0, globals_1.expect)(result).toEqual("function test() {}"); // No change
    });
});
(0, globals_1.describe)("collectInterfaceNames", () => {
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks(); // Clear mocks before each test
    });
    (0, globals_1.afterEach)(() => {
        globals_1.jest.restoreAllMocks(); // Restore all mocks after each test
    });
    (0, globals_1.test)("should collect interface names from lines", () => {
        const lines = [
            "export interface MyInterface {",
            "export interface AnotherInterface {",
            "some other line",
            "export interface YetAnotherInterface {",
        ];
        const result = postProcessingModule.collectInterfaceNames(lines);
        (0, globals_1.expect)(result).toEqual(new Set(["MyInterface", "AnotherInterface", "YetAnotherInterface"]));
    });
    (0, globals_1.test)("should return an empty set if no interfaces are found", () => {
        const lines = ["some other line", "function test() {}", "const value = 42;"];
        const result = postProcessingModule.collectInterfaceNames(lines);
        (0, globals_1.expect)(result).toEqual(new Set());
    });
    (0, globals_1.test)("should not add duplicate interface names", () => {
        const lines = ["export interface MyInterface {", "export interface MyInterface {"];
        const result = postProcessingModule.collectInterfaceNames(lines);
        (0, globals_1.expect)(result).toEqual(new Set(["MyInterface"]));
    });
});
(0, globals_1.describe)("writeFile", () => {
    const mockFilePath = "test/path/to/file.ts";
    const mockContent = "export const test = 'Test content';";
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks(); // Clear mocks before each test
    });
    (0, globals_1.afterEach)(() => {
        globals_1.jest.restoreAllMocks(); // Restore all mocks after each test
    });
    (0, globals_1.test)("should write file content successfully", () => {
        // Simulate fs.writeFileSync working as expected
        fs.writeFileSync.mockImplementation(() => { });
        // Call the function
        postProcessingModule.writeFile(mockFilePath, mockContent);
        // Assert that writeFileSync was called with the correct arguments
        (0, globals_1.expect)(fs.writeFileSync).toHaveBeenCalledWith(mockFilePath, mockContent, "utf8");
    });
    (0, globals_1.test)("should throw an error when writeFileSync fails", () => {
        // Simulate fs.writeFileSync throwing an error
        fs.writeFileSync.mockImplementation(() => {
            throw new Error("File write error");
        });
        // Expect the function to throw the error
        (0, globals_1.expect)(() => postProcessingModule.writeFile(mockFilePath, mockContent)).toThrow(`Failed to write file at ${mockFilePath}: File write error`);
    });
});
(0, globals_1.describe)("readFile", () => {
    const mockFilePath = "test/path/to/file.ts";
    const mockContent = "export const test = 'Test content';";
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks(); // Clear mocks before each test
    });
    (0, globals_1.afterEach)(() => {
        globals_1.jest.restoreAllMocks(); // Restore all mocks after each test
    });
    (0, globals_1.test)("should read file content successfully", () => {
        // Simulate fs.readFileSync returning content
        fs.readFileSync.mockReturnValue(mockContent);
        // Call the function
        const result = postProcessingModule.readFile(mockFilePath);
        // Assert that readFileSync was called with the correct arguments
        (0, globals_1.expect)(fs.readFileSync).toHaveBeenCalledWith(mockFilePath, "utf8");
        // Assert that the result matches the mock content
        (0, globals_1.expect)(result).toBe(mockContent);
    });
    (0, globals_1.test)("should throw an error when readFileSync fails", () => {
        // Simulate fs.readFileSync throwing an error
        fs.readFileSync.mockImplementation(() => {
            throw new Error("File read error");
        });
        // Expect the function to throw the error
        (0, globals_1.expect)(() => postProcessingModule.readFile(mockFilePath)).toThrow(`Failed to read file at ${mockFilePath}: File read error`);
    });
});
