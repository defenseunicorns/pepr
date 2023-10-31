// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { CapabilityExport } from "./types";
import { createRBACMap, addVerbIfNotExists } from "./helpers";
import { expect, describe, test, jest } from "@jest/globals";
import { promises as fs } from "fs";
import { createDirectoryIfNotExists } from "./helpers";

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

    // Ensure the function throws an error with the expected code
    try {
      await createDirectoryIfNotExists(directoryPath);
    } catch (error) {
      expect(error.code).toEqual("ERROR");
    }
  });
});
