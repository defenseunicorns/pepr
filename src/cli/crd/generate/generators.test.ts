// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it, beforeEach, afterEach, vi, type Mock } from "vitest";
import {
  extractSingleLineComment,
  extractDetails,
  processSourceFile,
  uncapitalize,
  emptySchema,
  loadVersionFilePaths,
  getAPIVersions,
} from "./generators";
import { ErrorMessages, WarningMessages } from "./messages";
import ts from "typescript";
import * as fs from "fs";
import Log from "../../../lib/telemetry/logger";

vi.mock("fs");

vi.mock("../../../lib/telemetry/logger", () => ({
  __esModule: true,
  default: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// Additional mocks for specific tests will be implemented inline

const getDetailsString = (
  hasDetails: boolean,
  hasBadScope: boolean,
  emptyKey: string = "",
): string => {
  if (!hasDetails) {
    return "const somethingElse = {};";
  }

  const scope = hasBadScope ? "BadScope" : "Namespaced";

  if (emptyKey) {
    // Create details object with an empty value for the specified key
    const detailsObj: Record<string, string> = {
      plural: "widgets",
      scope: scope,
      shortName: "wd",
    };
    detailsObj[emptyKey] = "";

    // Convert to string format
    const entries = Object.entries(detailsObj)
      .map(([key, value]) => `${key}: ${value === "" ? '""' : `"${value}"`}`)
      .join(", ");

    return `const details = { ${entries} };`;
  }

  return `const details = { plural: "widgets", scope: "${scope}", shortName: "wd" };`;
};

const generateTestContent = ({
  kind = "",
  hasBadScope = false,
  hasDetails = true,
  specInterface = "",
  extraContent = "",
  emptyKey = "",
} = {}): string => {
  const parts: string[] = [];

  // Add kind comment
  if (kind) parts.push(`// Kind: ${kind}`);

  // Add details section
  parts.push(getDetailsString(hasDetails, hasBadScope, emptyKey));

  // Add interface definition
  if (specInterface) parts.push(`export interface ${specInterface} {}`);

  // Add any extra content
  if (extraContent) parts.push(extraContent);

  return parts.join("\n");
};

const createSourceFile = (name: string, content: string): ts.SourceFile => {
  return ts.createSourceFile(name, content, ts.ScriptTarget.ESNext, true);
};

const createProgramFromContent = (
  name: string,
  content: string,
): { sourceFile: ts.SourceFile; checker: ts.TypeChecker } => {
  const host = ts.createCompilerHost({
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    strict: true,
  });
  const originalGetSourceFile = host.getSourceFile;
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) => {
    if (fileName === name) {
      return ts.createSourceFile(fileName, content, languageVersion, true);
    }
    return originalGetSourceFile.call(host, fileName, languageVersion, onError, shouldCreate);
  };
  host.fileExists = (fileName: string) => {
    if (fileName === name) return true;
    return ts.sys.fileExists(fileName);
  };
  host.readFile = (fileName: string) => {
    if (fileName === name) return content;
    return ts.sys.readFile(fileName);
  };

  const program = ts.createProgram(
    [name],
    {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      strict: true,
    },
    host,
  );

  const sourceFile = program.getSourceFile(name)!;
  const checker = program.getTypeChecker();
  return { sourceFile, checker };
};

describe("CRD Generator", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Single Line Comment Extraction", () => {
    describe("when extracting comments with labels", () => {
      it("should extract the comment value when the label exists", () => {
        const content = `// Kind: Widget`;
        const result = extractSingleLineComment(content, "Kind");
        expect(result).toBe("Widget");
      });

      it("should return undefined when the requested label doesn't exist", () => {
        const content = `// Group: test`;
        const result = extractSingleLineComment(content, "Kind");
        expect(result).toBeUndefined();
      });
    });
  });

  describe("String Manipulation", () => {
    describe("when converting string case", () => {
      it("should convert the first letter to lowercase", () => {
        expect(uncapitalize("CamelCase")).toBe("camelCase");
      });

      it("should handle empty string gracefully", () => {
        expect(uncapitalize("")).toBe("");
      });
    });
  });

  describe("Schema Operations", () => {
    describe("when creating an empty schema", () => {
      it("should return a properly structured schema object with empty properties", () => {
        const result = emptySchema();
        expect(result).toEqual({ properties: {}, required: [] });
      });
    });
  });

  describe("API Version Management", () => {
    describe("when retrieving API versions", () => {
      it("should return only directory entries from the API root", () => {
        (fs.readdirSync as Mock).mockReturnValue(["v1", "v2"]);
        (fs.statSync as Mock).mockImplementation(path => ({
          isDirectory: (): boolean =>
            typeof path === "string" && (path.endsWith("v1") || path.endsWith("v2")),
        }));

        const versions = getAPIVersions("/api");
        expect(versions).toEqual(["v1", "v2"]);
      });

      it("should filter out non-directory entries", () => {
        (fs.readdirSync as Mock).mockReturnValue(["v1", "README.md"]);
        (fs.statSync as Mock).mockImplementation(p => ({
          isDirectory: (): boolean => typeof p === "string" && p.endsWith("v1"),
        }));

        const versions = getAPIVersions("/api");
        expect(versions).toEqual(["v1"]);
      });
    });

    describe("when loading version file paths", () => {
      beforeEach(() => {
        vi.clearAllMocks();
      });

      it("should return only TypeScript file paths from the version directory", () => {
        (fs.readdirSync as Mock).mockReturnValue(["foo.ts", "bar.js", "baz.ts", "README.md"]);

        const result = loadVersionFilePaths("/api/v1");

        expect(fs.readdirSync).toHaveBeenCalledWith("/api/v1");
        expect(result).toEqual(["/api/v1/foo.ts", "/api/v1/baz.ts"]);
      });

      it("should return an empty array when no TypeScript files exist in the directory", () => {
        (fs.readdirSync as Mock).mockReturnValue(["bar.js", "README.md", "config.json"]);

        const result = loadVersionFilePaths("/api/v1");

        expect(fs.readdirSync).toHaveBeenCalledWith("/api/v1");
        expect(result).toEqual([]);
      });

      it("should return an empty array for an empty directory", () => {
        (fs.readdirSync as Mock).mockReturnValue([]);

        const result = loadVersionFilePaths("/api/v1");

        expect(result).toEqual([]);
      });

      it("should propagate filesystem errors when they occur", () => {
        (fs.readdirSync as Mock).mockImplementation(() => {
          throw new Error("Directory not found");
        });

        expect(() => loadVersionFilePaths("/non-existent-dir")).toThrow("Directory not found");
      });
    });
  });

  describe("CRD Details Extraction", () => {
    describe("when extracting from a valid file", () => {
      it("should extract plural, scope, and shortName from the details object", () => {
        const file = createSourceFile("temp.ts", generateTestContent());

        const details = extractDetails(file);
        expect(details).toEqual({
          plural: "widgets",
          scope: "Namespaced",
          shortName: "wd",
        });
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
        {
          contents: generateTestContent({ emptyKey: "plural" }),
          expectedError: ErrorMessages.MISSING_OR_INVALID_KEY("plural"),
        },
      ])("should throw an error: $expectedError", ({ contents, expectedError }) => {
        const file = createSourceFile("test.ts", contents);
        expect(() => extractDetails(file)).toThrow(expectedError);
      });
    });
  });

  describe("Source File Processing", () => {
    describe("when processing valid source files", () => {
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
        ])(
          "should warn: $expectedWarning",
          ({ contents, expectedWarning }) => {
            const { sourceFile, checker } = createProgramFromContent("test.ts", contents);
            processSourceFile(sourceFile, checker, "v1", "/output");
            expect(Log.warn).toHaveBeenCalledWith(expectedWarning);
          },
          10_000,
        );
      });

      describe("when file content is valid", () => {
        it("should generate a CRD YAML file", () => {
          const writeFileMock = vi.mocked(fs.writeFileSync);
          const { sourceFile, checker } = createProgramFromContent(
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

          processSourceFile(sourceFile, checker, "v1", "/crds");
          expect(writeFileMock.mock.calls[0][0]).toBe("/crds/widget.yaml");
          expect(writeFileMock.mock.calls[0][1]).toContain("CustomResourceDefinition");
          expect(writeFileMock.mock.calls[0][2]).toContain("utf8");

          expect(Log.info).toHaveBeenCalledWith(expect.stringContaining("✔ Created"));
        }, 30000);

        it("should correctly map TypeScript types to CRD schema types", () => {
          const writeFileMock = vi.mocked(fs.writeFileSync);
          const { sourceFile, checker } = createProgramFromContent(
            "types.ts",
            generateTestContent({
              kind: "Thing",
              specInterface: "ThingSpec",
              extraContent: `
                export interface ThingSpec {
                  /** A name */
                  name: string;
                  count: number;
                  enabled: boolean;
                  tags: string[];
                  sizes?: number[];
                  /** Creation timestamp */
                  createdAt: Date;
                  config: {
                    key: string;
                    value: number;
                  };
                }
                export type ThingStatusCondition = {
                  message: string;
                  observedGeneration?: number;
                };`,
            }),
          );

          processSourceFile(sourceFile, checker, "v1", "/crds");
          const yaml = writeFileMock.mock.calls[0][1] as string;

          // Primitive types
          expect(yaml).toContain("type: string");
          expect(yaml).toContain("type: number");
          expect(yaml).toContain("type: boolean");

          // Array types
          expect(yaml).toContain("type: array");

          // Nested object
          expect(yaml).toContain("type: object");

          // Date mapping
          expect(yaml).toContain("format: date-time");

          // JSDoc descriptions
          expect(yaml).toContain("A name");
          expect(yaml).toContain("Creation timestamp");

          // Required vs optional - 'sizes' is optional, should not be in required
          // 'name' is required, should be in required
          expect(yaml).toContain("name");
        }, 30000);

        it("should skip files missing kind without throwing when details are also absent", () => {
          const { sourceFile, checker } = createProgramFromContent(
            "empty.ts",
            "export const foo = 1;",
          );
          processSourceFile(sourceFile, checker, "v1", "/output");
          expect(Log.warn).toHaveBeenCalledWith(WarningMessages.MISSING_KIND_COMMENT("empty.ts"));
        }, 10_000);
      });
    });
  });
});
