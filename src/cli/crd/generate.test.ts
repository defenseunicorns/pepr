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
  ErrorMessages,
} from "./generate";
import { Project } from "ts-morph";
import * as fs from "fs";

jest.mock("fs");

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
      const file = createProjectWithFile(
        "temp.ts",
        `
        const details = { plural: "widgets", scope: "Namespaced", shortName: "wd" };
      `,
      );

      const details = extractDetails(file);
      expect(details).toEqual({
        plural: "widgets",
        scope: "Namespaced",
        shortName: "wd",
      });
    });

    it.each([
      {
        contents: 'const details = { plural: "widgets", scope: "BadScope", shortName: "wd" };',
        errorType: "INVALID_SCOPE",
        scope: "BadScope",
      },
      {
        contents: "const somethingElse = {};",
        errorType: "MISSING_DETAILS",
      },
    ])("should throw $errorType", ({ contents, errorType, scope }) => {
      const file = createProjectWithFile("test.ts", contents);

      if (errorType === "INVALID_SCOPE" && scope) {
        expect(() => extractDetails(file)).toThrow(ErrorMessages.INVALID_SCOPE(scope));
      } else if (errorType === "MISSING_DETAILS") {
        expect(() => extractDetails(file)).toThrow(ErrorMessages.MISSING_DETAILS);
      }
    });
  });

  describe("processSourceFile", () => {
    const createProjectWithFile = (name: string, content: string) => {
      const project = new Project();
      return project.createSourceFile(name, content);
    };

    it.each([
      {
        contents: `const details = { plural: "widgets", scope: "Cluster", shortName: "wd" };\nexport interface SomethingSpec {}`,
        errorType: "MISSING_KIND_COMMENT",
        fileName: "test.ts",
      },
      {
        contents: `// Kind: Something\nconst details = { plural: "widgets", scope: "Cluster", shortName: "wd" };`,
        errorType: "MISSING_INTERFACE",
        fileName: "test.ts",
        kind: "Something",
      },
    ])("should warn when $errorType", ({ contents, errorType, fileName, kind }) => {
      const consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
      const file = createProjectWithFile(fileName, contents);
      processSourceFile(file, "v1", "/output");

      if (errorType === "MISSING_KIND_COMMENT") {
        expect(consoleWarn).toHaveBeenCalledWith(ErrorMessages.MISSING_KIND_COMMENT(fileName));
      } else if (errorType === "MISSING_INTERFACE" && kind) {
        expect(consoleWarn).toHaveBeenCalledWith(ErrorMessages.MISSING_INTERFACE(fileName, kind));
      }
    });

    it("should generate a CRD YAML file for valid input", () => {
      const writeFileSync = jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});
      const consoleLog = jest.spyOn(console, "log").mockImplementation(() => {});
      const file = createProjectWithFile(
        "valid.ts",
        `
        // Kind: Widget
        const details = { plural: "widgets", scope: "Namespaced", shortName: "wd" };

        export interface WidgetSpec {
          /** The name */
          name: string;
        }

        export type WidgetStatusCondition = {
          /** The type */
          type: string;
        };
      `,
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
