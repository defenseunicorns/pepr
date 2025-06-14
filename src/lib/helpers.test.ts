// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { CapabilityExport } from "./types";
import { Event } from "./enums";
import {
  bindingAndCapabilityNSConflict,
  createRBACMap,
  dedent,
  generateWatchNamespaceError,
  hasAnyOverlap,
  hasEveryOverlap,
  ignoredNamespaceConflict,
  matchesRegex,
  namespaceComplianceValidator,
  parseTimeout,
  replaceString,
  secretOverLimit,
  validateHash,
  validateCapabilityNames,
  ValidationError,
} from "./helpers";
import { sanitizeResourceName } from "../sdk/sdk";
import * as fc from "fast-check";
import { expect, describe, vi, beforeEach, afterEach, it, type MockInstance } from "vitest";
import { kind } from "kubernetes-fluent-client";

export const callback = (): void => undefined;

const mockCapabilities: CapabilityExport[] = JSON.parse(`[
    {
        "name": "hello-pepr",
        "description": "A simple example capability to show how things work.",
        "namespaces": [
            "pepr-demo",
            "pepr-demo-2"
        ],
        "bindings": [
            {
                "kind": {
                    "kind": "Namespace",
                    "version": "v1",
                    "group": ""
                },
                "event": "CREATE",
                "filters": {
                    "name": "",
                    "namespaces": [],
                    "labels": {},
                    "annotations": {}
                },
                "isMutate": true
            },
            {
                "kind": {
                    "kind": "Namespace",
                    "version": "v1",
                    "group": ""
                },
                "event": "DELETE",
                "filters": {
                    "name": "pepr-demo-2",
                    "namespaces": [],
                    "labels": {},
                    "annotations": {}
                },
                "isWatch": true
            },
            {
                "kind": {
                    "kind": "ConfigMap",
                    "version": "v1",
                    "group": ""
                },
                "event": "CREATE",
                "filters": {
                    "name": "example-1",
                    "namespaces": [],
                    "labels": {},
                    "annotations": {}
                },
                "isMutate": true
            },
            {
                "kind": {
                    "kind": "ConfigMap",
                    "version": "v1",
                    "group": ""
                },
                "event": "UPDATE",
                "filters": {
                    "name": "example-2",
                    "namespaces": [],
                    "labels": {},
                    "annotations": {}
                },
                "isMutate": true
            },
            {
                "kind": {
                    "kind": "ConfigMap",
                    "version": "v1",
                    "group": ""
                },
                "event": "CREATE",
                "filters": {
                    "name": "example-2",
                    "namespaces": [],
                    "labels": {},
                    "annotations": {}
                },
                "isValidate": true
            },
            {
                "kind": {
                    "kind": "ConfigMap",
                    "version": "v1",
                    "group": ""
                },
                "event": "CREATE",
                "filters": {
                    "name": "example-2",
                    "namespaces": [],
                    "labels": {},
                    "annotations": {}
                },
                "isWatch": true
            },
            {
                "kind": {
                    "kind": "ConfigMap",
                    "version": "v1",
                    "group": ""
                },
                "event": "CREATE",
                "filters": {
                    "name": "",
                    "namespaces": [],
                    "labels": {},
                    "annotations": {}
                },
                "isValidate": true
            },
            {
                "kind": {
                    "kind": "ConfigMap",
                    "version": "v1",
                    "group": ""
                },
                "event": "CREATEORUPDATE",
                "filters": {
                    "name": "",
                    "namespaces": [],
                    "labels": {
                        "change": "by-label"
                    },
                    "annotations": {}
                },
                "isMutate": true
            },
            {
                "kind": {
                    "kind": "ConfigMap",
                    "version": "v1",
                    "group": ""
                },
                "event": "DELETE",
                "filters": {
                    "name": "",
                    "namespaces": [],
                    "labels": {
                        "change": "by-label"
                    },
                    "annotations": {}
                },
                "isValidate": true
            },
            {
                "kind": {
                    "kind": "ConfigMap",
                    "version": "v1",
                    "group": ""
                },
                "event": "CREATE",
                "filters": {
                    "name": "example-4",
                    "namespaces": [],
                    "labels": {},
                    "annotations": {}
                },
                "isMutate": true
            },
            {
                "kind": {
                    "kind": "ConfigMap",
                    "version": "v1",
                    "group": ""
                },
                "event": "CREATE",
                "filters": {
                    "name": "example-4a",
                    "namespaces": [
                        "pepr-demo-2"
                    ],
                    "labels": {},
                    "annotations": {}
                },
                "isMutate": true
            },
            {
                "kind": {
                    "kind": "ConfigMap",
                    "version": "v1",
                    "group": ""
                },
                "event": "CREATE",
                "filters": {
                    "name": "",
                    "namespaces": [],
                    "labels": {
                        "chuck-norris": ""
                    },
                    "annotations": {}
                },
                "isMutate": true
            },
            {
                "kind": {
                    "kind": "Secret",
                    "version": "v1",
                    "group": ""
                },
                "event": "CREATE",
                "filters": {
                    "name": "secret-1",
                    "namespaces": [],
                    "labels": {},
                    "annotations": {}
                },
                "isMutate": true
            },
            {
                "kind": {
                    "group": "pepr.dev",
                    "version": "v1",
                    "kind": "Unicorn"
                },
                "event": "CREATE",
                "filters": {
                    "name": "example-1",
                    "namespaces": [],
                    "labels": {},
                    "annotations": {}
                },
                "isMutate": true
            },
            {
                "kind": {
                    "group": "pepr.dev",
                    "version": "v1",
                    "kind": "Unicorn"
                },
                "event": "CREATE",
                "filters": {
                    "name": "example-2",
                    "namespaces": [],
                    "labels": {},
                    "annotations": {}
                },
                "isMutate": true
            }
        ]
    }
]`);

describe("validateCapabilityNames Property-Based Tests", () => {
  it("should only accept names that are valid after sanitation", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.string(),
            bindings: fc.array(fc.anything()),
            hasSchedule: fc.boolean(),
          }),
        ),
        capabilities => {
          if (capabilities.every(cap => cap.name === sanitizeResourceName(cap.name))) {
            expect(() => validateCapabilityNames(capabilities as CapabilityExport[])).not.toThrow();
          } else {
            expect(() => validateCapabilityNames(capabilities as CapabilityExport[])).toThrowError(
              /not a valid Kubernetes resource name/,
            );
          }
        },
      ),
    );
  });
});

describe("validateCapabilityNames", () => {
  it("should return true if all capability names are valid", () => {
    const capabilities = mockCapabilities;
    expect(() => validateCapabilityNames(capabilities)).not.toThrow();
  });

  it("should throw an error if a capability name is invalid", () => {
    const capabilities = mockCapabilities;
    capabilities[0].name = "invalid name";
    expect(() => validateCapabilityNames(capabilities)).toThrowError(ValidationError);
  });

  it("should ignore when capabilities are not loaded", () => {
    expect(validateCapabilityNames(undefined)).toBe(undefined);
  });
});

describe("createRBACMap", () => {
  it("should return the correct RBACMap for given capabilities", () => {
    const result = createRBACMap(mockCapabilities);

    const expected = {
      "pepr.dev/v1/peprstore": {
        verbs: ["create", "get", "patch", "watch"],
        plural: "peprstores",
      },
      "apiextensions.k8s.io/v1/customresourcedefinition": {
        verbs: ["patch", "create"],
        plural: "customresourcedefinitions",
      },
      "/v1/Namespace": { verbs: ["watch"], plural: "namespaces" },
      "/v1/ConfigMap": { verbs: ["watch"], plural: "configmaps" },
    };

    expect(result).toEqual(expected);
  });
});

describe("hasAnyOverlap", () => {
  it("returns true for overlapping arrays", () => {
    expect(hasAnyOverlap([1, 2, 3], [3, 4, 5])).toBe(true);
  });

  it("returns false for non-overlapping arrays", () => {
    expect(hasAnyOverlap([1, 2, 3], [4, 5, 6])).toBe(false);
  });

  it("returns false for empty arrays", () => {
    expect(hasAnyOverlap([], [1, 2, 3])).toBe(false);
    expect(hasAnyOverlap([1, 2, 3], [])).toBe(false);
  });

  it("returns false for two empty arrays", () => {
    expect(hasAnyOverlap([], [])).toBe(false);
  });
});

describe("hasEveryOverlap", () => {
  it("returns true if all elements in array1 are in array2", () => {
    expect(hasEveryOverlap([1, 2], [1, 2, 3])).toBe(true);
  });

  it("returns false if any element in array1 is not in array2", () => {
    expect(hasEveryOverlap([1, 2, 4], [1, 2, 3])).toBe(false);
  });

  it("returns true if array1 is empty", () => {
    expect(hasEveryOverlap([], [1, 2, 3])).toBe(true);
  });

  it("returns false if array2 is empty", () => {
    expect(hasEveryOverlap([1, 2], [])).toBe(false);
  });

  it("returns true if both arrays are empty", () => {
    expect(hasEveryOverlap([], [])).toBe(true);
  });
});

describe("ignoredNamespaceConflict", () => {
  it("returns true if there is an overlap", () => {
    expect(ignoredNamespaceConflict(["ns1", "ns2"], ["ns2", "ns3"])).toBe(true);
  });

  it("returns false if there is no overlap", () => {
    expect(ignoredNamespaceConflict(["ns1", "ns2"], ["ns3", "ns4"])).toBe(false);
  });

  it("returns false if either array is empty", () => {
    expect(ignoredNamespaceConflict([], ["ns1", "ns2"])).toBe(false);
    expect(ignoredNamespaceConflict(["ns1", "ns2"], [])).toBe(false);
  });

  it("returns false if both arrays are empty", () => {
    expect(ignoredNamespaceConflict([], [])).toBe(false);
  });
});

describe("bindingAndCapabilityNSConflict", () => {
  it("returns false if capabilityNamespaces is empty", () => {
    expect(bindingAndCapabilityNSConflict(["ns1", "ns2"], [])).toBe(false);
  });

  it("returns true if capability namespaces are not empty and there is no overlap with binding namespaces", () => {
    expect(bindingAndCapabilityNSConflict(["ns1", "ns2"], ["ns3", "ns4"])).toBe(true);
  });

  it("returns true if capability namespaces are not empty and there is an overlap", () => {
    expect(bindingAndCapabilityNSConflict(["ns1", "ns2"], ["ns2", "ns3"])).toBe(true);
  });

  it("returns false if both arrays are empty", () => {
    expect(bindingAndCapabilityNSConflict([], [])).toBe(false);
  });
});

describe("generateWatchNamespaceError", () => {
  it("returns error for ignored namespace conflict", () => {
    const error = generateWatchNamespaceError(["ns1"], ["ns1"], []);
    expect(error).toBe(
      "Binding uses a Pepr ignored namespace: ignoredNamespaces: [ns1] bindingNamespaces: [ns1].",
    );
  });

  it("returns error for binding and capability namespace conflict", () => {
    const error = generateWatchNamespaceError([""], ["ns2"], ["ns3"]);
    expect(error).toBe(
      "Binding uses namespace not governed by capability: bindingNamespaces: [ns2] capabilityNamespaces: [ns3].",
    );
  });

  it("returns combined error for both conflicts", () => {
    const error = generateWatchNamespaceError(["ns1"], ["ns1"], ["ns3", "ns4"]);
    expect(error).toBe(
      "Binding uses a Pepr ignored namespace: ignoredNamespaces: [ns1] bindingNamespaces: [ns1]. Binding uses namespace not governed by capability: bindingNamespaces: [ns1] capabilityNamespaces: [ns3, ns4].",
    );
  });

  it("returns empty string when there are no conflicts", () => {
    const error = generateWatchNamespaceError([], ["ns2"], []);
    expect(error).toBe("");
  });
});

const namespaceViolation: CapabilityExport[] = JSON.parse(`[
  {
      "name": "test-capability-namespaces",
      "description": "Should be confined to namespaces listed in capabilities and not be able to use ignored namespaces",
      "namespaces": [
          "miami",
          "dallas",
          "milwaukee"
      ],
      "bindings": [
          {
              "kind": {
                  "kind": "Namespace",
                  "version": "v1",
                  "group": ""
              },
              "event": "CREATE",
              "filters": {
                  "name": "",
                  "namespaces": ["new york"],
                  "labels": {},
                  "annotations": {}
              },
              "isMutate": true
          }
      ]
  }
]`);

const allNSCapabilities: CapabilityExport[] = JSON.parse(`[
  {
      "name": "test-capability-namespaces",
      "description": "Should be confined to namespaces listed in capabilities and not be able to use ignored namespaces",
      "namespaces": [],
      "bindings": [
          {
              "kind": {
                  "kind": "Namespace",
                  "version": "v1",
                  "group": ""
              },
              "event": "CREATE",
              "filters": {
                  "name": "",
                  "namespaces": ["new york"],
                  "labels": {},
                  "annotations": {}
              },
              "isMutate": true
          }
      ]
  }
]`);

const nonNsViolation: CapabilityExport[] = [
  {
    name: "test-capability-namespaces",
    description:
      "Should be confined to namespaces listed in capabilities and not be able to use ignored namespaces",
    namespaces: ["miami", "dallas", "milwaukee"],
    bindings: [
      {
        kind: {
          kind: "Namespace",
          version: "v1",
          group: "",
        },
        model: kind.Pod,
        event: Event.CREATE,
        filters: {
          name: "",
          namespaces: ["miami"],
          labels: {},
          annotations: {},
          deletionTimestamp: false,
          regexName: "",
          regexNamespaces: [],
        },
        isMutate: true,
      },
    ],
    hasSchedule: false,
  },
];

describe("namespaceComplianceValidator", () => {
  let errorSpy: MockInstance<(message?: unknown, ...optionalParams: unknown[]) => void>;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });
  it("should throw error for invalid regex namespaces", () => {
    const namespaceViolationCapability: CapabilityExport = {
      ...nonNsViolation[0],
      bindings: nonNsViolation[0].bindings.map(binding => ({
        ...binding,
        filters: {
          ...binding.filters,
          namespaces: [],
          regexNamespaces: [new RegExp("^system").source],
        },
      })),
    };
    expect(() => {
      namespaceComplianceValidator(namespaceViolationCapability);
    }).toThrowError(
      `Ignoring Watch Callback: Object namespace does not match any capability namespace with regex ${namespaceViolationCapability.bindings[0].filters.regexNamespaces[0]}.`,
    );
  });
  it("should not throw an error for valid regex namespaces", () => {
    const nonNamespaceViolationCapability: CapabilityExport = {
      ...nonNsViolation[0],
      bindings: nonNsViolation[0].bindings.map(binding => ({
        ...binding,
        filters: {
          ...binding.filters,
          namespaces: [],
          regexNamespaces: [new RegExp("^mia").source],
        },
      })),
    };
    expect(() => {
      namespaceComplianceValidator(nonNamespaceViolationCapability);
    }).not.toThrow();
  });
  it("should throw error for invalid regex ignored namespaces", () => {
    const namespaceViolationCapability: CapabilityExport = {
      ...nonNsViolation[0],
      bindings: nonNsViolation[0].bindings.map(binding => ({
        ...binding,
        filters: {
          ...binding.filters,
          namespaces: [],
          regexNamespaces: [new RegExp("^mia").source],
        },
      })),
    };
    expect(() => {
      namespaceComplianceValidator(namespaceViolationCapability, ["miami"]);
    }).toThrowError(
      `Ignoring Watch Callback: Regex namespace: ${namespaceViolationCapability.bindings[0].filters.regexNamespaces[0]}, is an ignored namespace: miami.`,
    );
  });
  it("should check watch bindings namespaces and regex namespaces", () => {
    const nonNamespaceViolationCapability: CapabilityExport = {
      ...nonNsViolation[0],
      bindings: nonNsViolation[0].bindings.map(binding => ({
        ...binding,
        filters: {
          ...binding.filters,
          namespaces: ["something"],
          regexNamespaces: [new RegExp("^brickell").source],
        },
        isWatch: true,
      })),
    };
    expect(() => {
      namespaceComplianceValidator(nonNamespaceViolationCapability, ["miami"], true);
    }).toThrow();
  });
  it("should check admission binding namespaces and regex namespaces", () => {
    const nonNamespaceViolationCapability: CapabilityExport = {
      ...nonNsViolation[0],
      bindings: nonNsViolation[0].bindings.map(binding => ({
        ...binding,
        filters: {
          ...binding.filters,
          namespaces: ["something"],
          regexNamespaces: [new RegExp("^brickell").source],
        },
        isWatch: true,
      })),
    };
    expect(() => {
      namespaceComplianceValidator(nonNamespaceViolationCapability, ["miami"], false);
    }).toThrow();
  });
  it("should not throw an error for valid regex ignored namespaces", () => {
    const nonNamespaceViolationCapability: CapabilityExport = {
      ...nonNsViolation[0],
      bindings: nonNsViolation[0].bindings.map(binding => ({
        ...binding,
        filters: {
          ...binding.filters,
          namespaces: [],
          regexNamespaces: [new RegExp("^mia").source],
        },
      })),
    };
    expect(() => {
      namespaceComplianceValidator(nonNamespaceViolationCapability, ["Seattle"]);
    }).not.toThrow();
  });
  it("should not throw an error for valid namespaces", () => {
    expect(() => {
      namespaceComplianceValidator(nonNsViolation[0]);
    }).not.toThrow();
  });

  it("should throw an error for binding namespace using a non capability namespace", () => {
    try {
      namespaceComplianceValidator(namespaceViolation[0]);
    } catch (e) {
      expect(e.message).toBe(
        "Error in test-capability-namespaces capability. A binding violates namespace rules. Please check ignoredNamespaces and capability namespaces: Binding uses namespace not governed by capability: bindingNamespaces: [new york] capabilityNamespaces: [miami, dallas, milwaukee].",
      );
    }
  });

  it("should throw an error for binding namespace using an ignored namespace: Part 1", () => {
    /*
     * this test case lists miami as a capability namespace, but also as an ignored namespace
     * in this case, there should be an error since ignoredNamespaces have precedence
     */
    try {
      namespaceComplianceValidator(nonNsViolation[0], ["miami"]);
    } catch (e) {
      expect(e.message).toBe(
        "Error in test-capability-namespaces capability. A binding violates namespace rules. Please check ignoredNamespaces and capability namespaces: Binding uses a Pepr ignored namespace: ignoredNamespaces: [miami] bindingNamespaces: [miami].",
      );
    }
  });

  it("should throw an error for binding namespace using an ignored namespace: Part 2", () => {
    /*
     * This capability uses all namespaces but new york should be ignored
     * the binding uses new york so it should fail
     */
    try {
      namespaceComplianceValidator(allNSCapabilities[0], ["new york"]);
    } catch (e) {
      expect(e.message).toBe(
        "Error in test-capability-namespaces capability. A binding violates namespace rules. Please check ignoredNamespaces and capability namespaces: Binding uses a Pepr ignored namespace: ignoredNamespaces: [new york] bindingNamespaces: [new york].",
      );
    }
  });
});

describe("parseTimeout", () => {
  it("should return a number when a valid string number between 1 and 30 is provided", () => {
    expect(parseTimeout("5")).toBe(5);
    expect(parseTimeout("1")).toBe(1);
    expect(parseTimeout("30")).toBe(30);
  });

  it("should throw an InvalidArgumentError for non-numeric strings", () => {
    expect(() => parseTimeout("abc")).toThrow(Error);
    expect(() => parseTimeout("")).toThrow(Error);
  });

  it("should throw an InvalidArgumentError for numbers outside the 1-30 range", () => {
    expect(() => parseTimeout("0")).toThrow(Error);
    expect(() => parseTimeout("31")).toThrow(Error);
  });

  it("should throw an InvalidArgumentError for numeric strings that represent floating point numbers", () => {
    expect(() => parseTimeout("5.5")).toThrow(Error);
    expect(() => parseTimeout("20.1")).toThrow(Error);
  });
});

describe("secretOverLimit", () => {
  it("should return true for a string larger than 1MiB", () => {
    const largeString = "a".repeat(1048577);
    expect(secretOverLimit(largeString)).toBe(true);
  });

  it("should return false for a string smaller than 1MiB", () => {
    const smallString = "a".repeat(1048575);
    expect(secretOverLimit(smallString)).toBe(false);
  });
});

describe("dedent", () => {
  it("removes leading spaces based on the smallest indentation", () => {
    const input = `
      kind: Namespace
      metadata:
        name: pepr-system
      `;
    const inputArray = dedent(input).split(/\r?\n/);

    expect(inputArray[0]).toBe("kind: Namespace");
    expect(inputArray[1]).toBe("metadata:");
    expect(inputArray[2]).toBe("  name: pepr-system");
  });

  it("does not remove internal spacing of lines", () => {
    const input = `kind: ->>>      Namespace`;

    expect(dedent(input)).toBe("kind: ->>>      Namespace");
  });

  it("handles strings without leading whitespace consistently", () => {
    const input = `kind: Namespace
metadata:`;

    const inputArray = dedent(input).split(/\r?\n/);
    expect(inputArray[0]).toBe("kind: Namespace");
    expect(inputArray[1]).toBe("metadata:");
  });

  it("handles empty strings without crashing", () => {
    const input = ``;
    const expected = ``;
    expect(dedent(input)).toBe(expected);
  });
});

describe("replaceString", () => {
  it("replaces single instance of a string", () => {
    const original = "Hello, world!";
    const stringA = "world";
    const stringB = "Jest";
    const expected = "Hello, Jest!";
    expect(replaceString(original, stringA, stringB)).toBe(expected);
  });

  it("replaces multiple instances of a string", () => {
    const original = "Repeat, repeat, repeat";
    const stringA = "repeat";
    const stringB = "done";
    const expected = "Repeat, done, done";
    expect(replaceString(original, stringA, stringB)).toBe(expected);
  });

  it("does nothing if string to replace is not found", () => {
    const original = "Nothing changes here";
    const stringA = "absent";
    const stringB = "present";
    const expected = "Nothing changes here";
    expect(replaceString(original, stringA, stringB)).toBe(expected);
  });

  it("escapes special regex characters in string to be replaced", () => {
    const original = "Find the period.";
    const stringA = ".";
    const stringB = "!";
    const expected = "Find the period!";
    expect(replaceString(original, stringA, stringB)).toBe(expected);
  });

  it("replaces string with empty string if stringB is empty", () => {
    const original = "Remove this part.";
    const stringA = " this part";
    const stringB = "";
    const expected = "Remove.";
    expect(replaceString(original, stringA, stringB)).toBe(expected);
  });
});

describe("validateHash", () => {
  let originalExit: (code?: number) => never;

  beforeEach(() => {
    originalExit = process.exit;
    process.exit = vi.fn() as unknown as (code?: number) => never;
  });

  afterEach(() => {
    process.exit = originalExit;
  });
  it("should throw ValidationError for invalid hash values", () => {
    // Examples of invalid hashes
    const invalidHashes = [
      "", // Empty string
      "12345", // Too short
      "zxcvbnmasdfghjklqwertyuiop1234567890zxcvbnmasdfghjklqwertyuio", // Contains invalid character 'z'
      "123456789012345678901234567890123456789012345678901234567890123", // 63 characters, one short
    ];

    invalidHashes.forEach(hash => {
      expect(() => validateHash(hash)).toThrow(ValidationError);
    });
  });

  it("should not throw ValidationError for valid SHA-256 hash", () => {
    // Example of a valid SHA-256 hash
    const validHash = "abc123def456abc123def456abc123def456abc123def456abc123def456abc1";
    expect(() => validateHash(validHash)).not.toThrow();
  });
});

describe("matchesRegex", () => {
  it("should return true for a valid pattern that matches the string", () => {
    const pattern = "abc";
    const testString = "abc123";
    const result = matchesRegex(pattern, testString);
    expect(result).toBe(true);
  });

  it("should return false for a valid pattern that does not match the string", () => {
    const pattern = "xyz";
    const testString = "abc123";
    const result = matchesRegex(pattern, testString);
    expect(result).toBe(false);
  });

  it("should return false for an invalid regex pattern", () => {
    const invalidPattern = "^p"; // Invalid regex with unclosed bracket
    const testString = "test";
    const result = matchesRegex(invalidPattern, testString);
    expect(result).toBe(false);
  });

  it("should return true for an empty string matching an empty regex", () => {
    const pattern = "";
    const testString = "";
    const result = matchesRegex(pattern, testString);
    expect(result).toBe(true);
  });

  it("should return false for an empty string and a non-empty regex", () => {
    const pattern = "abc";
    const testString = "";
    const result = matchesRegex(pattern, testString);
    expect(result).toBe(false);
  });

  it("should return true for a complex valid regex that matches", () => {
    const pattern = "^[a-zA-Z0-9]+@[a-zA-Z0-9]+.[A-Za-z]+$";
    const testString = "test@example.com";
    const result = matchesRegex(pattern, testString);
    expect(result).toBe(true);
  });

  it("should return false for a complex valid regex that does not match", () => {
    const pattern = "^[a-zA-Z0-9]+@[a-zA-Z0-9]+.[A-Za-z]+$";
    const testString = "invalid-email.com";
    const result = matchesRegex(pattern, testString);
    expect(result).toBe(false);
  });
});
