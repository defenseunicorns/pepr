// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Kubernetes Fluent Client Authors

import * as postProcessingModule from "./postProcessing";
import { NodeFileSystem } from "./fileSystem";
import { GenerateOptions } from "./generate";
import { jest, beforeEach, test, expect, describe, afterEach } from "@jest/globals";
//import { SpyInstance } from "jest-mock";
import { CustomResourceDefinition } from "./upstream";
import * as fs from "fs"; // We'll mock fs

// Mock fs
jest.mock("fs");

// Mock path.join
jest.mock("path", () => ({
  join: (...args: string[]) => args.join("/"), // Simulates path.join behavior
}));

// Mock NodeFileSystem methods
jest.mock("./fileSystem", () => ({
  NodeFileSystem: jest.fn().mockImplementation(() => ({
    readdirSync: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
  })),
}));

jest.mock("./types", () => ({
  GenericKind: jest.fn().mockImplementation(() => ({
    kind: "MockKind",
    apiVersion: "v1",
  })),
}));

jest.mock("./postProcessing", () => {
  const originalModule = jest.requireActual("./postProcessing");
  return {
    ...(typeof originalModule === "object" ? originalModule : {}),
    processAndModifySingleFile: jest.fn(), // Mock the specific function
    mapFilesToCRD: jest.fn(), // Mock mapFilesToCRD to avoid conflict
  };
});

const mockFileSystem = new NodeFileSystem();

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
const mockOpts: GenerateOptions = {
  directory: "mockDir",
  logFn: jest.fn(), // Mock logging function
  language: "ts",
  plain: false,
  npmPackage: "mockPackage",
  source: "",
};

describe("postProcessing", () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test
  });

  afterEach(() => {
    jest.restoreAllMocks(); // Restore all mocks after each test
  });

  test("should log error when directory is not defined", async () => {
    const optsWithoutDirectory = { ...mockOpts, directory: undefined };

    await postProcessingModule.postProcessing(mockCRDResults, optsWithoutDirectory, mockFileSystem);

    expect(mockOpts.logFn).toHaveBeenCalledWith("⚠️ Error: Directory is not defined.");
  });

  test("should read files from directory and process them", async () => {
    const mockFileResultMap = { "TestKind-v1.ts": mockCRDResults[0] };
    jest.spyOn(mockFileSystem, "readFile").mockReturnValue("mock content");
    jest.spyOn(mockFileSystem, "writeFile");

    await postProcessingModule.processFiles(
      ["TestKind-v1.ts"],
      mockFileResultMap,
      mockOpts,
      mockFileSystem,
    );

    expect(mockFileSystem.readFile).toHaveBeenCalledWith("mockDir/TestKind-v1.ts");
    expect(mockFileSystem.writeFile).toHaveBeenCalled();
  });

  test("should log error when failing to read the file", async () => {
    // Mock a situation where the file exists but reading it fails
    const mockFileResultMap = { "TestKind-v1.ts": mockCRDResults[0] };

    // Simulate readFile throwing an error
    jest.spyOn(mockFileSystem, "readFile").mockImplementation(() => {
      throw new Error("File read error");
    });

    await postProcessingModule.processFiles(
      ["TestKind-v1.ts"],
      mockFileResultMap,
      mockOpts,
      mockFileSystem,
    );

    // Verify the error log
    expect(mockOpts.logFn).toHaveBeenCalledWith(
      "❌ Error processing file: mockDir/TestKind-v1.ts - File read error",
    );
  });

  test("should log start and completion messages", async () => {
    jest.spyOn(mockFileSystem, "readdirSync").mockReturnValue(["TestKind-v1.ts"]);
    jest
      .spyOn(postProcessingModule, "mapFilesToCRD")
      .mockReturnValue({ "TestKind-v1.ts": mockCRDResults[0] });
    //jest.spyOn(postProcessingModule, "processFiles").mockImplementation(() => Promise.resolve());

    await postProcessingModule.postProcessing(mockCRDResults, mockOpts, mockFileSystem);

    // Verify the start message was logged
    expect(mockOpts.logFn).toHaveBeenCalledWith("\n🔧 Post-processing started...");

    // Verify the completion message was logged
    expect(mockOpts.logFn).toHaveBeenCalledWith("🔧 Post-processing completed.\n");
  });

  test("should handle readdirSync error gracefully", async () => {
    // Simulate an error when reading the directory
    jest.spyOn(mockFileSystem, "readdirSync").mockImplementation(() => {
      throw new Error("Directory read error");
    });

    await expect(
      postProcessingModule.postProcessing(mockCRDResults, mockOpts, mockFileSystem),
    ).rejects.toThrow("Directory read error");

    // Ensure the process is not continued after the error
    expect(mockOpts.logFn).not.toHaveBeenCalledWith("🔧 Post-processing completed.\n");
  });
});

describe("mapFilesToCRD", () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test
  });

  afterEach(() => {
    jest.restoreAllMocks(); // Restore all mocks after each test
  });

  test("should map files to corresponding CRD results", () => {
    const result = postProcessingModule.mapFilesToCRD(mockCRDResults);
    expect(result).toEqual({
      "TestKind-v1.ts": mockCRDResults[0],
    });
  });

  test("should log a warning if no matching CRD result found for a file", async () => {
    const mockFiles = ["NonExistingKind.ts"];
    const mockFileResultMap = {};

    await postProcessingModule.processFiles(mockFiles, mockFileResultMap, mockOpts, mockFileSystem);

    expect(mockOpts.logFn).toHaveBeenCalledWith(
      "⚠️ Warning: No matching CRD result found for file: mockDir/NonExistingKind.ts",
    );
  });
});

describe("applyCRDPostProcessing", () => {
  const mockContent = "mock content";
  const mockOpts = {
    directory: "mockDir",
    logFn: jest.fn(),
    language: "ts",
    plain: false,
    npmPackage: "mockPackage",
    source: "",
  };

  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test
  });

  afterEach(() => {
    jest.restoreAllMocks(); // Restore all mocks after each test
  });

  test("should process TypeScript file content", () => {
    const result = postProcessingModule.applyCRDPostProcessing(
      mockContent,
      "TestKind",
      mockCRDResults[0].crd,
      "v1",
      mockOpts,
    );

    expect(result).toContain("mock content");
    // Add more assertions based on what is expected after processing
  });

  test("should process TypeScript file content", () => {
    const result = postProcessingModule.applyCRDPostProcessing(
      mockContent,
      "TestKind",
      mockCRDResults[0].crd,
      "v1",
      mockOpts,
    );

    expect(result).toContain("mock content");
    // Add more assertions based on what is expected after processing
  });
});

describe("processFiles", () => {
  const mockOptsWithoutDirectory = { ...mockOpts, directory: undefined };

  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test
  });

  afterEach(() => {
    jest.restoreAllMocks(); // Restore all mocks after each test
  });

  test("should process files in directory", async () => {
    const mockFileResultMap = { "TestKind-v1.ts": mockCRDResults[0] };
    jest.spyOn(mockFileSystem, "readFile").mockReturnValue("mock content");
    jest.spyOn(mockFileSystem, "writeFile");

    await postProcessingModule.processFiles(
      ["TestKind-v1.ts"],
      mockFileResultMap,
      mockOpts,
      mockFileSystem,
    );

    expect(mockFileSystem.readFile).toHaveBeenCalledWith("mockDir/TestKind-v1.ts");
    expect(mockFileSystem.writeFile).toHaveBeenCalled();
  });

  test("should throw an error if directory is not defined", async () => {
    const mockFiles = ["TestKind-v1.ts"];
    const mockFileResultMap = { "TestKind-v1.ts": mockCRDResults[0] };

    await expect(
      postProcessingModule.processFiles(
        mockFiles,
        mockFileResultMap,
        mockOptsWithoutDirectory,
        mockFileSystem,
      ),
    ).rejects.toThrow("Directory is not defined");
  });
});

describe("wrapWithFluentClient", () => {
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

  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test
  });

  test("should replace interface declaration with class extending GenericKind", () => {
    const inputLines = ["export interface TestKind {", "  prop: string;", "}"];

    const crd = {
      spec: {
        group: "test.group",
        names: { plural: "testkinds" },
      },
    } as CustomResourceDefinition; // mock the CRD

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

    const result = postProcessingModule.wrapWithFluentClient(
      inputLines,
      "TestKind",
      crd,
      "v1",
      "mockPackage",
    );

    expect(result).toEqual(expectedOutputLines);
  });
});

describe("getGenericKindProperties", () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test
  });

  afterEach(() => {
    jest.restoreAllMocks(); // Restore all mocks after each test
  });

  test("should retrieve properties from GenericKind", () => {
    const result = postProcessingModule.getGenericKindProperties();
    expect(result).toContain("kind");
    expect(result).toContain("apiVersion");
    expect(result).not.toContain("[key: string]");
  });
});

describe("processLines", () => {
  const mockLines = ["export class TestKind extends GenericKind {", "  kind: string;", "}"];

  const mockFoundInterfaces = new Set<string>(["TestKind"]);
  const mockGenericKindProperties = ["kind", "apiVersion"];

  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test
  });

  afterEach(() => {
    jest.restoreAllMocks(); // Restore all mocks after each test
  });

  test("should process lines and modify properties of classes extending GenericKind", () => {
    const result = postProcessingModule.processLines(
      mockLines,
      mockGenericKindProperties,
      mockFoundInterfaces,
    );
    expect(result).toContain("  declare kind: string;");
  });
});

describe("processClassContext", () => {
  const mockGenericKindProperties = ["kind"];
  const mockFoundInterfaces = new Set<string>();

  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test
  });

  afterEach(() => {
    jest.restoreAllMocks(); // Restore all mocks after each test
  });

  test("should detect class extending GenericKind and modify context", () => {
    const line = "export class TestKind extends GenericKind {";
    const result = postProcessingModule.processClassContext(
      line,
      false,
      0,
      mockGenericKindProperties,
      mockFoundInterfaces,
    );
    expect(result.insideClass).toBe(true);
    expect(result.braceBalance).toBe(1);
  });

  test("should update brace balance when closing braces are found", () => {
    const line = "}";
    const result = postProcessingModule.processClassContext(
      line,
      true,
      1,
      mockGenericKindProperties,
      mockFoundInterfaces,
    );
    expect(result.insideClass).toBe(false);
    expect(result.braceBalance).toBe(0);
  });
});

describe("normalizeIndentationAndSpacing", () => {
  const mockOpts = {
    language: "ts",
    source: "",
    logFn: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test
  });

  afterEach(() => {
    jest.restoreAllMocks(); // Restore all mocks after each test
  });

  test("should normalize indentation to two spaces", () => {
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

    expect(result).toEqual(expectedResult);
  });

  test("should normalize single line indentation to two spaces", () => {
    const cases = [
      { input: "    indentedWithFourSpaces;", expected: "  indentedWithFourSpaces;" }, // 4 spaces to 2 spaces
      { input: "  alreadyTwoSpaces;", expected: "  alreadyTwoSpaces;" }, // 2 spaces, no change
      { input: "      sixSpacesIndent;", expected: "    sixSpacesIndent;" }, // First 4 spaces to 2
      { input: "noIndent;", expected: "noIndent;" }, // No indentation, no change
    ];

    cases.forEach(({ input, expected }) => {
      const result = postProcessingModule.normalizeLineIndentation(input);
      expect(result).toBe(expected);
    });
  });

  test("should normalize property spacing", () => {
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

    expect(result).toEqual(expectedLines);
  });

  test('should remove lines containing "[property: string]: any;" when language is "ts" or "typescript"', () => {
    const inputLines = [
      "someProp: string;",
      "[property: string]: any;",
      "anotherProp: number;",
      "[property: string]: any;",
    ];

    // Test for TypeScript
    const tsOpts: GenerateOptions = { ...mockOpts, language: "ts" };
    const resultTs = postProcessingModule.removePropertyStringAny(inputLines, tsOpts);
    const expectedTs = ["someProp: string;", "anotherProp: number;"];
    expect(resultTs).toEqual(expectedTs);

    // Test for TypeScript with "typescript" as language
    const typescriptOpts: GenerateOptions = { ...mockOpts, language: "typescript" };
    const resultTypescript = postProcessingModule.removePropertyStringAny(
      inputLines,
      typescriptOpts,
    );
    expect(resultTypescript).toEqual(expectedTs);
  });

  describe("processEslintDisable", () => {
    beforeEach(() => {
      jest.clearAllMocks(); // Clear mocks before each test
    });

    afterEach(() => {
      jest.restoreAllMocks(); // Restore all mocks after each test
    });

    test('should add ESLint disable comment if line contains "[key: string]: any" and is not part of genericKindProperties', () => {
      const line = "[key: string]: any;";
      const genericKindProperties = ["kind", "apiVersion"]; // No "[key: string]" present

      const result = postProcessingModule.processEslintDisable(line, genericKindProperties);

      expect(result).toEqual(
        "  // eslint-disable-next-line @typescript-eslint/no-explicit-any\n[key: string]: any;",
      );
    });

    test('should not add ESLint disable comment if "[key: string]" is in genericKindProperties', () => {
      const line = "[key: string]: any;";
      const genericKindProperties = ["[key: string]", "kind", "apiVersion"]; // "[key: string]" present

      const result = postProcessingModule.processEslintDisable(line, genericKindProperties);

      expect(result).toEqual("[key: string]: any;"); // No comment added
    });

    test('should not add ESLint disable comment if line does not contain "[key: string]: any"', () => {
      const line = "prop: string;";
      const genericKindProperties = ["kind", "apiVersion"]; // Normal properties

      const result = postProcessingModule.processEslintDisable(line, genericKindProperties);

      expect(result).toEqual("prop: string;"); // No change in the line
    });

    test('should not add ESLint disable comment if line contains "[key: string]: any" but is part of genericKindProperties', () => {
      const line = "[key: string]: any;";
      const genericKindProperties = ["[key: string]"];

      const result = postProcessingModule.processEslintDisable(line, genericKindProperties);

      expect(result).toEqual("[key: string]: any;"); // No comment added since it's in genericKindProperties
    });
  });

  test('should not remove lines when language is not "ts" or "typescript"', () => {
    const inputLines = ["someProp: string;", "[property: string]: any;", "anotherProp: number;"];

    // Test for other languages
    const otherOpts: GenerateOptions = { ...mockOpts, language: "js" }; // Not TypeScript
    const resultOther = postProcessingModule.removePropertyStringAny(inputLines, otherOpts);
    expect(resultOther).toEqual(inputLines); // Should return the original lines
  });
});

describe("makePropertiesOptional", () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test
  });

  afterEach(() => {
    jest.restoreAllMocks(); // Restore all mocks after each test
  });

  test("should make property optional if type is found in interfaces and not already optional", () => {
    const line = "myProp: MyInterface;";
    const foundInterfaces = new Set(["MyInterface"]); // Matching interface

    const result = postProcessingModule.makePropertiesOptional(line, foundInterfaces);

    expect(result).toEqual("myProp?: MyInterface;"); // The colon is replaced by `?:`
  });

  test("should not make property optional if type is not found in interfaces", () => {
    const line = "myProp: AnotherType;";
    const foundInterfaces = new Set(["MyInterface"]); // No match for this type

    const result = postProcessingModule.makePropertiesOptional(line, foundInterfaces);

    expect(result).toEqual("myProp: AnotherType;"); // No change
  });

  test("should not make property optional if already optional", () => {
    const line = "myProp?: MyInterface;";
    const foundInterfaces = new Set(["MyInterface"]); // Matching interface, but already optional

    const result = postProcessingModule.makePropertiesOptional(line, foundInterfaces);

    expect(result).toEqual("myProp?: MyInterface;"); // No change since it's already optional
  });

  test("should not change line if it does not match the property pattern", () => {
    const line = "function test() {}";
    const foundInterfaces = new Set(["MyInterface"]); // Matching interface, but the line is not a property

    const result = postProcessingModule.makePropertiesOptional(line, foundInterfaces);

    expect(result).toEqual("function test() {}"); // No change
  });
});

describe("collectInterfaceNames", () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test
  });

  afterEach(() => {
    jest.restoreAllMocks(); // Restore all mocks after each test
  });

  test("should collect interface names from lines", () => {
    const lines = [
      "export interface MyInterface {",
      "export interface AnotherInterface {",
      "some other line",
      "export interface YetAnotherInterface {",
    ];

    const result = postProcessingModule.collectInterfaceNames(lines);

    expect(result).toEqual(new Set(["MyInterface", "AnotherInterface", "YetAnotherInterface"]));
  });

  test("should return an empty set if no interfaces are found", () => {
    const lines = ["some other line", "function test() {}", "const value = 42;"];

    const result = postProcessingModule.collectInterfaceNames(lines);

    expect(result).toEqual(new Set());
  });

  test("should not add duplicate interface names", () => {
    const lines = ["export interface MyInterface {", "export interface MyInterface {"];

    const result = postProcessingModule.collectInterfaceNames(lines);

    expect(result).toEqual(new Set(["MyInterface"]));
  });
});

describe("writeFile", () => {
  const mockFilePath = "test/path/to/file.ts";
  const mockContent = "export const test = 'Test content';";

  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test
  });

  afterEach(() => {
    jest.restoreAllMocks(); // Restore all mocks after each test
  });

  test("should write file content successfully", () => {
    // Simulate fs.writeFileSync working as expected
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});

    // Call the function
    postProcessingModule.writeFile(mockFilePath, mockContent);

    // Assert that writeFileSync was called with the correct arguments
    expect(fs.writeFileSync).toHaveBeenCalledWith(mockFilePath, mockContent, "utf8");
  });

  test("should throw an error when writeFileSync fails", () => {
    // Simulate fs.writeFileSync throwing an error
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {
      throw new Error("File write error");
    });

    // Expect the function to throw the error
    expect(() => postProcessingModule.writeFile(mockFilePath, mockContent)).toThrow(
      `Failed to write file at ${mockFilePath}: File write error`,
    );
  });
});

describe("readFile", () => {
  const mockFilePath = "test/path/to/file.ts";
  const mockContent = "export const test = 'Test content';";

  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test
  });

  afterEach(() => {
    jest.restoreAllMocks(); // Restore all mocks after each test
  });

  test("should read file content successfully", () => {
    // Simulate fs.readFileSync returning content
    (fs.readFileSync as jest.Mock).mockReturnValue(mockContent);

    // Call the function
    const result = postProcessingModule.readFile(mockFilePath);

    // Assert that readFileSync was called with the correct arguments
    expect(fs.readFileSync).toHaveBeenCalledWith(mockFilePath, "utf8");

    // Assert that the result matches the mock content
    expect(result).toBe(mockContent);
  });

  test("should throw an error when readFileSync fails", () => {
    // Simulate fs.readFileSync throwing an error
    (fs.readFileSync as jest.Mock).mockImplementation(() => {
      throw new Error("File read error");
    });

    // Expect the function to throw the error
    expect(() => postProcessingModule.readFile(mockFilePath)).toThrow(
      `Failed to read file at ${mockFilePath}: File read error`,
    );
  });
});
