// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it, beforeEach, afterEach, vi, type Mock } from "vitest";
import {
  extractSingleLineComment,
  extractDetails,
  processSourceFile,
  uncapitalize,
  emptySchema,
  loadVersionFiles,
  getAPIVersions,
} from "./generate";
import { ErrorMessages, WarningMessages } from "./messages";
import { Project, type SourceFile } from "ts-morph";
import * as fs from "fs";
import Log from "../../lib/telemetry/logger";

vi.mock("fs");

vi.mock("../../lib/telemetry/logger", () => ({
  __esModule: true,
  default: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// Helper function to get details string based on parameters
const getDetailsString = (hasDetails: boolean, hasBadScope: boolean): string => {
  if (!hasDetails) {
    return "const somethingElse = {};";
  }

  const scope = hasBadScope ? "BadScope" : "Namespaced";
  return `const details = { plural: "widgets", scope: "${scope}", shortName: "wd" };`;
};

// Generates test content for CRD tests by combining different parts
const generateTestContent = ({
  kind = "",
  hasBadScope = false,
  hasDetails = true,
  specInterface = "",
  extraContent = "",
} = {}): string => {
  const parts: string[] = [];

  // Add kind comment
  if (kind) parts.push(`// Kind: ${kind}`);

  // Add details section
  parts.push(getDetailsString(hasDetails, hasBadScope));

  // Add interface definition
  if (specInterface) parts.push(`export interface ${specInterface} {}`);

  // Add any extra content
  if (extraContent) parts.push(extraContent);

  return parts.join("\n");
};

const createProjectWithFile = (name: string, content: string): SourceFile => {
  const project = new Project();
  return project.createSourceFile(name, content);
};

describe("generate.ts", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("when extracting single line comments", () => {
    it("should extract a labeled single line comment", () => {
      const content = `// Kind: Widget`;
      const result = extractSingleLineComment(content, "Kind");
      expect(result).toBe("Widget");
    });

    it("should return undefined if label is missing", () => {
      const content = `// Group: test`;
      const result = extractSingleLineComment(content, "Kind");
      expect(result).toBeUndefined();
    });
  });

  describe("when manipulating strings", () => {
    it("should convert the first letter to lowercase", () => {
      expect(uncapitalize("CamelCase")).toBe("camelCase");
    });

    it("should return empty string when input is empty", () => {
      expect(uncapitalize("")).toBe("");
    });
  });

  describe("when working with schemas", () => {
    describe("given an emptySchema", () => {
      it("should return an object with empty properties and required arrays", () => {
        const result = emptySchema();
        expect(result).toEqual({ properties: {}, required: [] });
      });
    });
  });

  describe("when managing API versions", () => {
    describe("getAPIVersions", () => {
      it("should return only directory entries from the api root", () => {
        (fs.readdirSync as Mock).mockReturnValue(["v1", "v2"]);
        (fs.statSync as Mock).mockImplementation(path => ({
          isDirectory: (): boolean =>
            typeof path === "string" && (path.endsWith("v1") || path.endsWith("v2")),
        }));

        const versions = getAPIVersions("/api");
        expect(versions).toEqual(["v1", "v2"]);
      });

      it("should ignore non-directory entries", () => {
        (fs.readdirSync as Mock).mockReturnValue(["v1", "README.md"]);
        (fs.statSync as Mock).mockImplementation(p => ({
          isDirectory: (): boolean => typeof p === "string" && p.endsWith("v1"),
        }));

        const versions = getAPIVersions("/api");
        expect(versions).toEqual(["v1"]);
      });
    });

    describe("loadVersionFiles", () => {
      beforeEach(() => {
        vi.clearAllMocks();
      });

      it("should load only TypeScript files from the version directory", () => {
        const project = new Project();
        // Create mock source files with type-coercion because only care about the return value behavior
        const mockReturnFiles = [
          "mock-source-file-1",
          "mock-source-file-2",
        ] as unknown as import("ts-morph").SourceFile[];

        (fs.readdirSync as Mock).mockReturnValue(["foo.ts", "bar.js", "baz.ts", "README.md"]);
        const projectSpy = vi
          .spyOn(project, "addSourceFilesAtPaths")
          .mockReturnValue(mockReturnFiles);

        const result = loadVersionFiles(project, "/api/v1");

        expect(fs.readdirSync).toHaveBeenCalledWith("/api/v1");
        expect(projectSpy).toHaveBeenCalledWith(["/api/v1/foo.ts", "/api/v1/baz.ts"]);
        expect(result).toBe(mockReturnFiles);
      });

      it("should return empty array when directory has no TypeScript files", () => {
        const project = new Project();
        (fs.readdirSync as Mock).mockReturnValue(["bar.js", "README.md", "config.json"]);
        const projectSpy = vi.spyOn(project, "addSourceFilesAtPaths").mockReturnValue([]);

        const result = loadVersionFiles(project, "/api/v1");

        expect(fs.readdirSync).toHaveBeenCalledWith("/api/v1");
        expect(projectSpy).toHaveBeenCalledWith([]);
        expect(result).toEqual([]);
      });

      it("should return empty array for empty directory", () => {
        const project = new Project();
        (fs.readdirSync as Mock).mockReturnValue([]);
        const projectSpy = vi.spyOn(project, "addSourceFilesAtPaths").mockReturnValue([]);

        const result = loadVersionFiles(project, "/api/v1");

        expect(projectSpy).toHaveBeenCalledWith([]);
        expect(result).toEqual([]);
      });

      it("should handle fs.readdirSync errors", () => {
        const project = new Project();
        (fs.readdirSync as Mock).mockImplementation(() => {
          throw new Error("Directory not found");
        });

        expect(() => loadVersionFiles(project, "/non-existent-dir")).toThrow("Directory not found");
      });
    });
  });

  describe("when extracting CRD details", () => {
    it("should extract plural, scope, and shortName from the details object", () => {
      const file = createProjectWithFile("temp.ts", generateTestContent());

      const details = extractDetails(file);
      expect(details).toEqual({
        plural: "widgets",
        scope: "Namespaced",
        shortName: "wd",
      });
    });

    describe("when details are invalid", () => {
      it.each([
        {
          contents: generateTestContent({ hasBadScope: true }),
          expectedError: ErrorMessages.INVALID_SCOPE("BadScope"),
        },
        {
          contents: generateTestContent({ hasDetails: false }),
          expectedError: ErrorMessages.MISSING_DETAILS,
        },
      ])("should throw: $expectedError", ({ contents, expectedError }) => {
        const file = createProjectWithFile("test.ts", contents);
        expect(() => extractDetails(file)).toThrow(expectedError);
      });
    });
  });

  describe("when processing source files", () => {
    describe("when file content is incomplete", () => {
      it.each([
        {
          contents: generateTestContent({ specInterface: "SomethingSpec" }),
          expectedWarning: WarningMessages.MISSING_KIND_COMMENT("test.ts"),
        },
        {
          contents: generateTestContent({ kind: "Something" }),
          expectedWarning: WarningMessages.MISSING_INTERFACE("test.ts", "Something"),
        },
      ])("should warn: $expectedWarning", ({ contents, expectedWarning }) => {
        const file = createProjectWithFile("test.ts", contents);
        processSourceFile(file, "v1", "/output");
        expect(Log.warn).toHaveBeenCalledWith(expectedWarning);
      });
    });

    describe("when file content is valid", () => {
      it("should generate a CRD YAML file", () => {
        const writeFileMock = vi.mocked(fs.writeFileSync);
        //const writeFileSync = vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});
        const file = createProjectWithFile(
          "valid.ts",
          generateTestContent({
            kind: "Widget",
            specInterface: "WidgetSpec",
            extraContent: `
            export type WidgetStatusCondition = {
              /** The type */
              type: string;
            };`,
          }),
        );

        processSourceFile(file, "v1", "/crds");
        expect(writeFileMock.mock.calls[0][0]).toBe("/crds/widget.yaml");
        expect(writeFileMock.mock.calls[0][1]).toContain("CustomResourceDefinition");
        expect(writeFileMock.mock.calls[0][2]).toContain("utf8");

        expect(Log.info).toHaveBeenCalledWith(expect.stringContaining("✔ Created"));
      }, 30000);
    });
  });
});
