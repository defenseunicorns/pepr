// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it } from "@jest/globals";
import { extractSingleLineComment, extractDetails, uncapitalize } from "./generate";
import { Project } from "ts-morph";

describe("extractSingleLineComment", () => {
  it.each([
    ["// Group: cache", "Group", "cache"],
    ["// Kind: Widget\n// Group: something", "Kind", "Widget"],
    ["// Group:   domain.io  ", "Group", "domain.io"],
    ["// NotMatching: nope", "Domain", undefined],
    ["", "Group", undefined],
  ])("extracts '%s' with label '%s' => '%s'", (content, label, expected) => {
    expect(extractSingleLineComment(content, label)).toBe(expected);
  });
});

describe("extractDetails", () => {
  const project = new Project();

  it("extracts all required fields correctly", () => {
    const sourceFile = project.createSourceFile(
      "valid.ts",
      `
      export const details = {
        plural: "widgets",
        scope: "Cluster",
        shortName: "wd"
      };
    `,
    );
    expect(extractDetails(sourceFile)).toEqual({
      plural: "widgets",
      scope: "Cluster",
      shortName: "wd",
    });
  });

  it("throws if 'details' variable is missing", () => {
    const sourceFile = project.createSourceFile(
      "missing-details.ts",
      `
      const unrelated = { foo: "bar" };
    `,
    );
    expect(() => extractDetails(sourceFile)).toThrow("Missing 'details' variable declaration.");
  });

  it("throws if 'plural' is missing", () => {
    const sourceFile = project.createSourceFile(
      "missing-plural.ts",
      `
      export const details = {
        scope: "Cluster",
        shortName: "wd"
      };
    `,
    );
    expect(() => extractDetails(sourceFile)).toThrow(
      "Missing or invalid value for required key: 'plural'",
    );
  });

  it("throws if 'scope' is missing", () => {
    const sourceFile = project.createSourceFile(
      "missing-scope.ts",
      `
      export const details = {
        plural: "widgets",
        shortName: "wd"
      };
    `,
    );
    expect(() => extractDetails(sourceFile)).toThrow(
      "Missing or invalid value for required key: 'scope'",
    );
  });

  it("throws if 'shortName' is missing", () => {
    const sourceFile = project.createSourceFile(
      "missing-shortName.ts",
      `
      export const details = {
        plural: "widgets",
        scope: "Cluster"
      };
    `,
    );
    expect(() => extractDetails(sourceFile)).toThrow(
      "Missing or invalid value for required key: 'shortName'",
    );
  });

  it("throws if 'scope' is not 'Cluster' or 'Namespaced'", () => {
    const sourceFile = project.createSourceFile(
      "invalid-scope.ts",
      `
      export const details = {
        plural: "widgets",
        scope: "Global",
        shortName: "wd"
      };
    `,
    );
    expect(() => extractDetails(sourceFile)).toThrow(
      `'scope' must be either "Cluster" or "Namespaced", got "Global"`,
    );
  });
});

describe("uncapitalize", () => {
  it.each([
    ["Test", "test"],
    ["Name", "name"],
    ["x", "x"],
    ["", ""],
  ])("uncapitalizes %s to %s", (input, expected) => {
    expect(uncapitalize(input)).toBe(expected);
  });
});
