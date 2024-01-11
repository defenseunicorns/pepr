// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { CapabilityExport } from "./types";
import { createRBACMap, addVerbIfNotExists } from "./helpers";
import { expect, describe, test, jest, beforeEach, afterEach } from "@jest/globals";
import { promises as fs } from "fs";
import {
  createDirectoryIfNotExists,
  hasAnyOverlap,
  hasEveryOverlap,
  ignoredNamespaceConflict,
  bindingAndCapabilityNSConflict,
  generateWatchNamespaceError,
  namespaceComplianceValidator,
} from "./helpers";
import { SpiedFunction } from "jest-mock";

import { K8s, GenericClass, KubernetesObject } from "kubernetes-fluent-client";
import { K8sInit } from "kubernetes-fluent-client/dist/fluent/types";
import { checkDeploymentStatus, namespaceDeploymentsReady } from "./helpers";

jest.mock("kubernetes-fluent-client", () => {
  return {
    K8s: jest.fn(),
    kind: jest.fn(),
  };
});

jest.mock("fs", () => {
  return {
    promises: {
      access: jest.fn(),
      mkdir: jest.fn(),
    },
  };
});

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

describe("createRBACMap", () => {
  test("should return the correct RBACMap for given capabilities", () => {
    const result = createRBACMap(mockCapabilities);

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
    expect(error).toBe("Binding uses a Pepr ignored namespace: ignoredNamespaces: [ns1] bindingNamespaces: [ns1].");
  });

  test("returns error for binding and capability namespace conflict", () => {
    const error = generateWatchNamespaceError([""], ["ns2"], ["ns3"]);
    expect(error).toBe(
      "Binding uses namespace not governed by capability: bindingNamespaces: [ns2] capabilityNamespaces:$[ns3].",
    );
  });

  test("returns combined error for both conflicts", () => {
    const error = generateWatchNamespaceError(["ns1"], ["ns1"], ["ns3", "ns4"]);
    expect(error).toBe(
      "Binding uses a Pepr ignored namespace: ignoredNamespaces: [ns1] bindingNamespaces: [ns1]. Binding uses namespace not governed by capability: bindingNamespaces: [ns1] capabilityNamespaces:$[ns3, ns4].",
    );
  });

  test("returns empty string when there are no conflicts", () => {
    const error = generateWatchNamespaceError([], ["ns2"], []);
    expect(error).toBe("");
  });
});

const nsViolation: CapabilityExport[] = JSON.parse(`[
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

const nonNsViolation: CapabilityExport[] = JSON.parse(`[
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
                  "namespaces": ["miami"],
                  "labels": {},
                  "annotations": {}
              },
              "isMutate": true
          }
      ]
  }
]`);

describe("namespaceComplianceValidator", () => {
  let errorSpy: SpiedFunction<{ (...data: unknown[]): void; (message?: unknown, ...optionalParams: unknown[]): void }>;
  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  test("should not throw an error for invalid namespaces", () => {
    expect(() => {
      namespaceComplianceValidator(nonNsViolation[0]);
    }).not.toThrow();
  });

  test("should throw an error for binding namespace using a non capability namespace", () => {
    try {
      namespaceComplianceValidator(nsViolation[0]);
    } catch (e) {
      expect(e.message).toBe(
        "Error in test-capability-namespaces capability. A binding violates namespace rules. Please check ignoredNamespaces and capability namespaces: Binding uses namespace not governed by capability: bindingNamespaces: [new york] capabilityNamespaces:$[miami, dallas, milwaukee].",
      );
    }
  });

  test("should throw an error for binding namespace using an ignored namespace: Part 1", () => {
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

  test("should throw an error for binding namespace using an ignored namespace: Part 2", () => {
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

describe("checkDeploymentStatus", () => {
  const mockK8s = jest.mocked(K8s);

  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    jest.useRealTimers();
  });
  test("should return true if all deployments are ready", async () => {
    const deployments = {
      items: [
        {
          metadata: {
            name: "watcher",
            namespace: "pepr-system",
          },
          spec: {
            replicas: 1,
          },
          status: {
            readyReplicas: 1,
          },
        },
        {
          metadata: {
            name: "admission",
            namespace: "pepr-system",
          },
          spec: {
            replicas: 2,
          },
          status: {
            readyReplicas: 2,
          },
        },
      ],
    };

    mockK8s.mockImplementation(<T extends GenericClass, K extends KubernetesObject>() => {
      return {
        InNamespace: jest.fn().mockReturnThis(),
        Get: () => deployments,
      } as unknown as K8sInit<T, K>;
    });

    const expected = true;
    const result = await checkDeploymentStatus("pepr-system");
    expect(result).toBe(expected);
  });

  test("should return false if any deployments are not ready", async () => {
    const deployments = {
      items: [
        {
          metadata: {
            name: "watcher",
            namespace: "pepr-system",
          },
          spec: {
            replicas: 1,
          },
          status: {
            readyReplicas: 1,
          },
        },
        {
          metadata: {
            name: "admission",
            namespace: "pepr-system",
          },
          spec: {
            replicas: 2,
          },
          status: {
            readyReplicas: 1,
          },
        },
      ],
    };

    mockK8s.mockImplementation(<T extends GenericClass, K extends KubernetesObject>() => {
      return {
        InNamespace: jest.fn().mockReturnThis(),
        Get: () => deployments,
      } as unknown as K8sInit<T, K>;
    });

    const expected = false;
    const result = await checkDeploymentStatus("pepr-system");
    expect(result).toBe(expected);
  });
});

describe("namespaceDeploymentsReady", () => {
  const mockK8s = jest.mocked(K8s);

  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    jest.useRealTimers();
  });

  test("should return true if all deployments are ready", async () => {
    const deployments = {
      items: [
        {
          metadata: {
            name: "watcher",
            namespace: "pepr-system",
          },
          spec: {
            replicas: 1,
          },
          status: {
            readyReplicas: 1,
          },
        },
        {
          metadata: {
            name: "admission",
            namespace: "pepr-system",
          },
          spec: {
            replicas: 2,
          },
          status: {
            readyReplicas: 2,
          },
        },
      ],
    };

    mockK8s.mockImplementation(<T extends GenericClass, K extends KubernetesObject>() => {
      return {
        InNamespace: jest.fn().mockReturnThis(),
        Get: () => deployments,
      } as unknown as K8sInit<T, K>;
    });

    const expected = true;
    const result = await namespaceDeploymentsReady();
    expect(result).toBe(expected);
  });

  test("should call checkDeploymentStatus if any deployments are not ready", async () => {
    const deployments = {
      items: [
        {
          metadata: {
            name: "watcher",
            namespace: "pepr-system",
          },
          spec: {
            replicas: 1,
          },
          status: {
            readyReplicas: 1,
          },
        },
        {
          metadata: {
            name: "admission",
            namespace: "pepr-system",
          },
          spec: {
            replicas: 2,
          },
          status: {
            readyReplicas: 1,
          },
        },
      ],
    };

    const deployments2 = {
      items: [
        {
          metadata: {
            name: "watcher",
            namespace: "pepr-system",
          },
          spec: {
            replicas: 1,
          },
          status: {
            readyReplicas: 1,
          },
        },
        {
          metadata: {
            name: "admission",
            namespace: "pepr-system",
          },
          spec: {
            replicas: 2,
          },
          status: {
            readyReplicas: 2,
          },
        },
      ],
    };

    mockK8s
      .mockImplementation(<T extends GenericClass, K extends KubernetesObject>() => {
        return {
          InNamespace: jest.fn().mockReturnThis(),
          Get: () => deployments,
        } as unknown as K8sInit<T, K>;
      })
      .mockImplementation(<T extends GenericClass, K extends KubernetesObject>() => {
        return {
          InNamespace: jest.fn().mockReturnThis(),
          Get: () => deployments2,
        } as unknown as K8sInit<T, K>;
      });

    const expected = true;
    const result = await namespaceDeploymentsReady();

    expect(result).toBe(expected);

    expect(mockK8s).toHaveBeenCalledTimes(1);
  });
});
