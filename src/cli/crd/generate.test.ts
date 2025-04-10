// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it } from "@jest/globals";
import {
  matchField,
  extractComment,
  extractConditionTypeProperties,
  extractSpecProperties,
  extractDetails,
  normalizeType,
  uncapitalize,
} from "./generate";

describe("extractComment", () => {
  it.each([
    ["// Group: cache", "Group", "cache"],
    ["// Kind: Widget\n// Group: something", "Kind", "Widget"],
    ["// Group:   domain.io  ", "Group", "domain.io"],
    ["// NotMatching: nope", "Domain", undefined],
    ["", "Group", undefined],
  ])("extracts '%s' with label '%s' => '%s'", (content, label, expected) => {
    expect(extractComment(content, label)).toBe(expected);
  });
});

describe("extractConditionTypeProperties", () => {
  it.each([
    [
      `type WidgetStatusCondition = {
/**
 * Timestamp of last change
 */
lastTransitionTime: Date;
/**
 * Reason for state
 */
reason: string;
status?: string;
};
`,
      "WidgetStatusCondition",
      {
        properties: {
          lastTransitionTime: {
            type: "string",
            format: "date-time",
            description: "Timestamp of last change",
          },
          reason: {
            type: "string",
            description: "Reason for state",
          },
          status: {
            type: "string",
          },
        },
        required: ["lastTransitionTime", "reason"],
      },
    ],
  ])("parses %s correctly", (content, typeName, expected) => {
    const actual = extractConditionTypeProperties(content, typeName);
    expect(actual).toEqual(expected);
  });
});

describe("extractSpecProperties", () => {
  it.each([
    [
      `export interface WidgetSpec {
  // Number of widgets
  count: number;

  // Optional name
  name?: string;

  // Labels
  labels: {
    team: string;
    zone?: string;
  };
}
`,
      "WidgetSpec",
      {
        count: { type: "number", description: "Number of widgets", _required: true },
        name: { type: "string", description: "Optional name", _required: false },
        labels: {
          type: "object",
          description: "Labels",
          _required: true,
          properties: {
            team: { type: "string" },
            zone: { type: "string" },
          },
          required: ["team"],
        },
      },
    ],
  ])("extracts properties from interface %s", (content, interfaceName, expected) => {
    const actual = extractSpecProperties(content, interfaceName);
    expect(actual).toEqual(expected);
  });
});
describe("extractDetails", () => {
  it.each([
    [
      `
      export const details = {
        plural: "widgets",
        scope: "Cluster",
        shortName: "wd"
      };
      `,
      { plural: "widgets", scope: "Cluster", shortName: "wd" },
    ],
    [
      `
      export const details = {
        plural: "things"
      };
      `,
      { plural: "things", scope: undefined, shortName: undefined },
    ],
    [
      `
      const unrelated = { foo: "bar" };
      `,
      {},
    ],
  ])("extracts details from: %s", (input, expected) => {
    expect(extractDetails(input)).toEqual(expected);
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

describe("normalizeType", () => {
  it.each([
    ["string", "string"],
    ["number", "number"],
    ["boolean", "boolean"],
    ["Date", "string"],
    ["SomethingElse", "string"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeType(input)).toBe(expected);
  });
});

describe("normalizeType", () => {
  it.each([
    ["string", "string"],
    ["number", "number"],
    ["boolean", "boolean"],
    ["Date", "string"],
    ["Foo", "string"],
  ])("normalizes TypeScript type %s to JSON Schema type %s", (input, expected) => {
    expect(normalizeType(input)).toBe(expected);
  });
});

describe("matchField", () => {
  it.each([
    [
      `
        plural: "widgets",
        scope: "Namespaced",
        shortName: "wg"
      `,
      "plural",
      "widgets",
    ],
    [
      `
        plural: "widgets",
        scope: "Namespaced",
        shortName: "wg"
      `,
      "scope",
      "Namespaced",
    ],
    [
      `
        plural: "widgets",
        scope: "Namespaced",
        shortName: "wg"
      `,
      "shortName",
      "wg",
    ],
    [
      `
        kind: "Gadget"
      `,
      "plural",
      undefined,
    ],
    [
      `
        plural   :    'things'
      `,
      "plural",
      "things",
    ],
    [
      `
        example: { foo: "bar" }
      `,
      "example",
      undefined,
    ],
  ])("extracts '%s' from key '%s' => '%s'", (input, key, expected) => {
    expect(matchField(input, key)).toBe(expected);
  });
});
