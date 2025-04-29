// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it, afterEach, jest } from "@jest/globals";
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
import { Project } from "ts-morph";
import * as fs from "fs";

jest.mock("fs");

const generateTestContent = (
  options: {
    hasKindComment?: boolean | string;
    hasDetails?: boolean | { scope?: string };
    hasInterface?: boolean | string;
    extraContent?: string;
  } = {},
): string => {
  const kindName =
    typeof options.hasKindComment === "string"
      ? options.hasKindComment
      : options.hasKindComment
        ? "Widget"
        : "";
  const kindLine = kindName ? `// Kind: ${kindName}\n` : "";

  let detailsLine = "const somethingElse = {};\n";
  if (options.hasDetails !== false) {
    const scope =
      options.hasDetails && typeof options.hasDetails === "object" && options.hasDetails.scope
        ? options.hasDetails.scope
        : "Namespaced";
    detailsLine = `const details = { plural: "widgets", scope: "${scope}", shortName: "wd" };\n`;
  }

  const interfaceName =
    typeof options.hasInterface === "string"
      ? options.hasInterface
      : options.hasInterface
        ? (kindName || "Something") + "Spec"
        : "";
  const interfaceLine = interfaceName ? `export interface ${interfaceName} {}\n` : "";

  return `${kindLine}${detailsLine}${interfaceLine}${options.extraContent || ""}`;
};

describe("generate.ts", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("extractSingleLineComment", () => {
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

  describe("uncapitalize", () => {
    it("should uncapitalize the first letter", () => {
      expect(uncapitalize("CamelCase")).toBe("camelCase");
    });

    it("should return empty string when input is empty", () => {
      expect(uncapitalize("")).toBe("");
    });
  });

  describe("emptySchema", () => {
    it("should return an empty schema object", () => {
      const result = emptySchema();
      expect(result).toEqual({ properties: {}, required: [] });
    });
  });

  describe("getAPIVersions", () => {
    it("should return directories from the api root", () => {
      (fs.readdirSync as jest.Mock).mockReturnValue(["v1", "v2"]);
      (fs.statSync as jest.Mock).mockImplementation(path => ({
        isDirectory: () => typeof path === "string" && (path.endsWith("v1") || path.endsWith("v2")),
      }));

      const versions = getAPIVersions("/api");
      expect(versions).toEqual(["v1", "v2"]);
    });

    it("should ignore non-directory entries", () => {
      (fs.readdirSync as jest.Mock).mockReturnValue(["v1", "README.md"]);
      (fs.statSync as jest.Mock).mockImplementation(p => ({
        isDirectory: () => typeof p === "string" && p.endsWith("v1"),
      }));

      const versions = getAPIVersions("/api");
      expect(versions).toEqual(["v1"]);
    });
  });

  describe("loadVersionFiles", () => {
    it("should load only TypeScript files from version directory", () => {
      const project = new Project();
      const addSpy = jest.spyOn(project, "addSourceFilesAtPaths").mockReturnValue([]); // don't resolve real files

      (fs.readdirSync as jest.Mock).mockReturnValue(["foo.ts", "bar.js", "baz.ts"]);

      const result = loadVersionFiles(project, "/api/v1");

      expect(addSpy).toHaveBeenCalledWith(["/api/v1/foo.ts", "/api/v1/baz.ts"]);
      expect(result).toEqual([]); // we mocked return value
    });
  });

  describe("extractDetails", () => {
    const createProjectWithFile = (name: string, content: string) => {
      const project = new Project();
      return project.createSourceFile(name, content);
    };

    it("should extract plural, scope, and shortName from the details object", () => {
      const file = createProjectWithFile("temp.ts", generateTestContent({ hasDetails: true }));

      const details = extractDetails(file);
      expect(details).toEqual({
        plural: "widgets",
        scope: "Namespaced",
        shortName: "wd",
      });
    });

    it.each([
      {
        contents: generateTestContent({
          hasDetails: { scope: "BadScope" },
        }),
        expectedError: ErrorMessages.INVALID_SCOPE("BadScope"),
      },
      {
        contents: generateTestContent({ hasDetails: false }),
        expectedError: ErrorMessages.MISSING_DETAILS,
      },
    ])("should throw error: $expectedError", ({ contents, expectedError }) => {
      const file = createProjectWithFile("test.ts", contents);
      expect(() => extractDetails(file)).toThrow(expectedError);
    });
  });

  describe("processSourceFile", () => {
    const createProjectWithFile = (name: string, content: string) => {
      const project = new Project();
      return project.createSourceFile(name, content);
    };

    it.each([
      {
        contents: generateTestContent({ hasInterface: true, hasKindComment: false }),
        expectedWarning: WarningMessages.MISSING_KIND_COMMENT("test.ts"),
      },
      {
        contents: generateTestContent({ hasKindComment: "Something", hasInterface: false }),
        expectedWarning: WarningMessages.MISSING_INTERFACE("test.ts", "Something"),
      },
    ])("should warn: $expectedWarning", ({ contents, expectedWarning }) => {
      const consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
      const file = createProjectWithFile("test.ts", contents);
      processSourceFile(file, "v1", "/output");
      expect(consoleWarn).toHaveBeenCalledWith(expectedWarning);
    });

    it("should generate a CRD YAML file for valid input", () => {
      const writeFileSync = jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});
      const consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});
      const file = createProjectWithFile(
        "valid.ts",
        generateTestContent({
          hasKindComment: "Widget",
          hasInterface: "WidgetSpec",
          extraContent: `
        export type WidgetStatusCondition = {
          /** The type */
          type: string;
        };`,
        }),
      );

      processSourceFile(file, "v1", "/crds");

      expect(writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining("/crds/widget.yaml"),
        expect.stringContaining("CustomResourceDefinition"),
        "utf8",
      );

      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining("✔ Created"));
    });
  });
});
