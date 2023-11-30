// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { CapabilityExport } from "./types";
import { createRBACMap, addVerbIfNotExists } from "./helpers";
import { expect, describe, test, jest } from "@jest/globals";
import { promises as fs } from "fs";
import {
  createDirectoryIfNotExists,
  hasAnyOverlap,
  hasEveryOverlap,
  ignoredNamespaceConflict,
  bindingAndCapabilityNSConflict,
  generateWatchNamespaceError,
} from "./helpers";

const capabilities: CapabilityExport[] = JSON.parse(`[
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

describe("createRBACMap", () => {
  test("should return the correct RBACMap for given capabilities", () => {
    const result = createRBACMap(capabilities);

    const expected = {
      "pepr.dev/v1/peprstore": {
        verbs: ["create", "get", "patch", "watch"],
        plural: "peprstores",
      },
      "/v1/Namespace": { verbs: ["watch"], plural: "namespaces" },
      "/v1/ConfigMap": { verbs: ["watch"], plural: "configmaps" },
    };

    expect(result).toEqual(expected);
  });
});

describe("addVerbIfNotExists", () => {
  test("should add a verb if it does not exist in the array", () => {
    const verbs = ["get", "list"];
    addVerbIfNotExists(verbs, "watch");
    expect(verbs).toEqual(["get", "list", "watch"]);
  });

  test("should not add a verb if it already exists in the array", () => {
    const verbs = ["get", "list", "watch"];
    addVerbIfNotExists(verbs, "get");
    expect(verbs).toEqual(["get", "list", "watch"]); // The array remains unchanged
  });
});

jest.mock("fs", () => {
  return {
    promises: {
      access: jest.fn(),
      mkdir: jest.fn(),
    },
  };
});

describe("createDirectoryIfNotExists function", () => {
  test("should create a directory if it doesn't exist", async () => {
    (fs.access as jest.Mock).mockRejectedValue({ code: "ENOENT" } as never);
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined as never);

    const directoryPath = "/pepr/pepr-test-module/asdf";

    await createDirectoryIfNotExists(directoryPath);

    expect(fs.access).toHaveBeenCalledWith(directoryPath);
    expect(fs.mkdir).toHaveBeenCalledWith(directoryPath, { recursive: true });
  });

  test("should not create a directory if it already exists", async () => {
    jest.resetAllMocks();
    (fs.access as jest.Mock).mockResolvedValue(undefined as never);

    const directoryPath = "/pepr/pepr-test-module/asdf";

    await createDirectoryIfNotExists(directoryPath);

    expect(fs.access).toHaveBeenCalledWith(directoryPath);
    expect(fs.mkdir).not.toHaveBeenCalled();
  });

  test("should throw an error for other fs.access errors", async () => {
    jest.resetAllMocks();
    (fs.access as jest.Mock).mockRejectedValue({ code: "ERROR" } as never);

    const directoryPath = "/pepr/pepr-test-module/asdf";

    try {
      await createDirectoryIfNotExists(directoryPath);
    } catch (error) {
      expect(error.code).toEqual("ERROR");
    }
  });
});

describe("hasAnyOverlap", () => {
  test("returns true for overlapping arrays", () => {
    expect(hasAnyOverlap([1, 2, 3], [3, 4, 5])).toBe(true);
  });

  test("returns false for non-overlapping arrays", () => {
    expect(hasAnyOverlap([1, 2, 3], [4, 5, 6])).toBe(false);
  });

  test("returns false for empty arrays", () => {
    expect(hasAnyOverlap([], [1, 2, 3])).toBe(false);
    expect(hasAnyOverlap([1, 2, 3], [])).toBe(false);
  });

  test("returns false for two empty arrays", () => {
    expect(hasAnyOverlap([], [])).toBe(false);
  });
});

describe("hasEveryOverlap", () => {
  test("returns true if all elements in array1 are in array2", () => {
    expect(hasEveryOverlap([1, 2], [1, 2, 3])).toBe(true);
  });

  test("returns false if any element in array1 is not in array2", () => {
    expect(hasEveryOverlap([1, 2, 4], [1, 2, 3])).toBe(false);
  });

  test("returns true if array1 is empty", () => {
    expect(hasEveryOverlap([], [1, 2, 3])).toBe(true);
  });

  test("returns false if array2 is empty", () => {
    expect(hasEveryOverlap([1, 2], [])).toBe(false);
  });

  test("returns true if both arrays are empty", () => {
    expect(hasEveryOverlap([], [])).toBe(true);
  });
});

describe("ignoredNamespaceConflict", () => {
  test("returns true if there is an overlap", () => {
    expect(ignoredNamespaceConflict(["ns1", "ns2"], ["ns2", "ns3"])).toBe(true);
  });

  test("returns false if there is no overlap", () => {
    expect(ignoredNamespaceConflict(["ns1", "ns2"], ["ns3", "ns4"])).toBe(false);
  });

  test("returns false if either array is empty", () => {
    expect(ignoredNamespaceConflict([], ["ns1", "ns2"])).toBe(false);
    expect(ignoredNamespaceConflict(["ns1", "ns2"], [])).toBe(false);
  });

  test("returns false if both arrays are empty", () => {
    expect(ignoredNamespaceConflict([], [])).toBe(false);
  });
});

describe("bindingAndCapabilityNSConflict", () => {
  test("returns false if capabilityNamespaces is empty", () => {
    expect(bindingAndCapabilityNSConflict(["ns1", "ns2"], [])).toBe(false);
  });

  test("returns true if capability namespaces are not empty and there is no overlap with binding namespaces", () => {
    expect(bindingAndCapabilityNSConflict(["ns1", "ns2"], ["ns3", "ns4"])).toBe(true);
  });

  test("returns true if capability namespaces are not empty and there is an overlap", () => {
    expect(bindingAndCapabilityNSConflict(["ns1", "ns2"], ["ns2", "ns3"])).toBe(true);
  });

  test("returns false if both arrays are empty", () => {
    expect(bindingAndCapabilityNSConflict([], [])).toBe(false);
  });
});

describe("generateWatchNamespaceError", () => {
  test("returns error for ignored namespace conflict", () => {
    const error = generateWatchNamespaceError(["ns1"], ["ns1"], []);
    expect(error).toBe("Binding uses a Pepr ignored namespace.");
  });

  test("returns error for binding and capability namespace conflict", () => {
    const error = generateWatchNamespaceError([""], ["ns2"], ["ns3"]);
    expect(error).toBe("Binding uses namespace not governed by capability.");
  });

  test("returns combined error for both conflicts", () => {
    const error = generateWatchNamespaceError(["ns1"], ["ns1"], ["ns3", "ns4"]);
    expect(error).toBe("Binding uses a Pepr ignored namespace. Binding uses namespace not governed by capability.");
  });

  test("returns empty string when there are no conflicts", () => {
    const error = generateWatchNamespaceError([], ["ns2"], []);
    expect(error).toBe("");
  });
});
