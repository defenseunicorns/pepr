// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Binding, CapabilityExport } from "./types";
import { Event } from "./enums";
import {
  addVerbIfNotExists,
  bindingAndCapabilityNSConflict,
  createRBACMap,
  checkDeploymentStatus,
  filterNoMatchReason,
  dedent,
  generateWatchNamespaceError,
  hasAnyOverlap,
  hasEveryOverlap,
  ignoredNamespaceConflict,
  matchesRegex,
  namespaceDeploymentsReady,
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
import { expect, describe, test, jest, beforeEach, afterEach, it } from "@jest/globals";
import { SpiedFunction } from "jest-mock";
import { K8s, GenericClass, KubernetesObject, kind, modelToGroupVersionKind } from "kubernetes-fluent-client";
import { K8sInit } from "kubernetes-fluent-client/dist/fluent/types";
import { defaultFilters, defaultKubernetesObject, defaultBinding } from "./filter/adjudicators/defaultTestObjects";
// import { defaultBinding, defaultFilters, defaultKubernetesObject } from "./filter/adjudicators/defaultTestObjects";

export const callback = () => undefined;

export const podKind = modelToGroupVersionKind(kind.Pod.name);
export const deploymentKind = modelToGroupVersionKind(kind.Deployment.name);
export const clusterRoleKind = modelToGroupVersionKind(kind.ClusterRole.name);

export const groupBinding: Binding = {
  event: Event.CREATE,
  filters: defaultFilters,
  kind: deploymentKind,
  model: kind.Deployment,
};

export const clusterScopedBinding: Binding = {
  event: Event.DELETE,
  filters: defaultFilters,
  kind: clusterRoleKind,
  model: kind.ClusterRole,
};
jest.mock("kubernetes-fluent-client", () => {
  return {
    K8s: jest.fn(),
    kind: jest.fn(),
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

describe("validateCapabilityNames Property-Based Tests", () => {
  test("should only accept names that are valid after sanitation", () => {
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
  test("should return true if all capability names are valid", () => {
    const capabilities = mockCapabilities;
    expect(() => validateCapabilityNames(capabilities)).not.toThrow();
  });

  test("should throw an error if a capability name is invalid", () => {
    const capabilities = mockCapabilities;
    capabilities[0].name = "invalid name";
    expect(() => validateCapabilityNames(capabilities)).toThrowError(ValidationError);
  });

  test("should ignore when capabilities are not loaded", () => {
    expect(validateCapabilityNames(undefined)).toBe(undefined);
  });
});

describe("createRBACMap", () => {
  test("should return the correct RBACMap for given capabilities", () => {
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
      "Binding uses namespace not governed by capability: bindingNamespaces: [ns2] capabilityNamespaces: [ns3].",
    );
  });

  test("returns combined error for both conflicts", () => {
    const error = generateWatchNamespaceError(["ns1"], ["ns1"], ["ns3", "ns4"]);
    expect(error).toBe(
      "Binding uses a Pepr ignored namespace: ignoredNamespaces: [ns1] bindingNamespaces: [ns1]. Binding uses namespace not governed by capability: bindingNamespaces: [ns1] capabilityNamespaces: [ns3, ns4].",
    );
  });

  test("returns empty string when there are no conflicts", () => {
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
    description: "Should be confined to namespaces listed in capabilities and not be able to use ignored namespaces",
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
  let errorSpy: SpiedFunction<{ (...data: unknown[]): void; (message?: unknown, ...optionalParams: unknown[]): void }>;
  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });
  test("should throw error for invalid regex namespaces", () => {
    const namespaceViolationCapability: CapabilityExport = {
      ...nonNsViolation[0],
      bindings: nonNsViolation[0].bindings.map(binding => ({
        ...binding,
        filters: {
          ...binding.filters,
          namespaces: [],
          regexNamespaces: ["^system"],
        },
      })),
    };
    expect(() => {
      namespaceComplianceValidator(namespaceViolationCapability);
    }).toThrowError(
      `Ignoring Watch Callback: Object namespace does not match any capability namespace with regex ${namespaceViolationCapability.bindings[0].filters.regexNamespaces[0]}.`,
    );
  });
  test("should not throw an error for valid regex namespaces", () => {
    const nonNamespaceViolationCapability: CapabilityExport = {
      ...nonNsViolation[0],
      bindings: nonNsViolation[0].bindings.map(binding => ({
        ...binding,
        filters: {
          ...binding.filters,
          namespaces: [],
          regexNamespaces: ["^mia"],
        },
      })),
    };
    expect(() => {
      namespaceComplianceValidator(nonNamespaceViolationCapability);
    }).not.toThrow();
  });
  test("should throw error for invalid regex ignored namespaces", () => {
    const namespaceViolationCapability: CapabilityExport = {
      ...nonNsViolation[0],
      bindings: nonNsViolation[0].bindings.map(binding => ({
        ...binding,
        filters: {
          ...binding.filters,
          namespaces: [],
          regexNamespaces: ["^mia"],
        },
      })),
    };
    expect(() => {
      namespaceComplianceValidator(namespaceViolationCapability, ["miami"]);
    }).toThrowError(
      `Ignoring Watch Callback: Regex namespace: ${namespaceViolationCapability.bindings[0].filters.regexNamespaces[0]}, is an ignored namespace: miami.`,
    );
  });
  test("should not throw an error for valid regex ignored namespaces", () => {
    const nonNamespaceViolationCapability: CapabilityExport = {
      ...nonNsViolation[0],
      bindings: nonNsViolation[0].bindings.map(binding => ({
        ...binding,
        filters: {
          ...binding.filters,
          namespaces: [],
          regexNamespaces: ["^mia"],
        },
      })),
    };
    expect(() => {
      namespaceComplianceValidator(nonNamespaceViolationCapability, ["Seattle"]);
    }).not.toThrow();
  });
  test("should not throw an error for valid namespaces", () => {
    expect(() => {
      namespaceComplianceValidator(nonNsViolation[0]);
    }).not.toThrow();
  });

  test("should throw an error for binding namespace using a non capability namespace", () => {
    try {
      namespaceComplianceValidator(namespaceViolation[0]);
    } catch (e) {
      expect(e.message).toBe(
        "Error in test-capability-namespaces capability. A binding violates namespace rules. Please check ignoredNamespaces and capability namespaces: Binding uses namespace not governed by capability: bindingNamespaces: [new york] capabilityNamespaces: [miami, dallas, milwaukee].",
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

describe("parseTimeout", () => {
  const PREV = "a";
  test("should return a number when a valid string number between 1 and 30 is provided", () => {
    expect(parseTimeout("5", PREV)).toBe(5);
    expect(parseTimeout("1", PREV)).toBe(1);
    expect(parseTimeout("30", PREV)).toBe(30);
  });

  test("should throw an InvalidArgumentError for non-numeric strings", () => {
    expect(() => parseTimeout("abc", PREV)).toThrow(Error);
    expect(() => parseTimeout("", PREV)).toThrow(Error);
  });

  test("should throw an InvalidArgumentError for numbers outside the 1-30 range", () => {
    expect(() => parseTimeout("0", PREV)).toThrow(Error);
    expect(() => parseTimeout("31", PREV)).toThrow(Error);
  });

  test("should throw an InvalidArgumentError for numeric strings that represent floating point numbers", () => {
    expect(() => parseTimeout("5.5", PREV)).toThrow(Error);
    expect(() => parseTimeout("20.1", PREV)).toThrow(Error);
  });
});

describe("secretOverLimit", () => {
  test("should return true for a string larger than 1MiB", () => {
    const largeString = "a".repeat(1048577);
    expect(secretOverLimit(largeString)).toBe(true);
  });

  test("should return false for a string smaller than 1MiB", () => {
    const smallString = "a".repeat(1048575);
    expect(secretOverLimit(smallString)).toBe(false);
  });
});

describe("dedent", () => {
  test("removes leading spaces based on the smallest indentation", () => {
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

  test("does not remove internal spacing of lines", () => {
    const input = `kind: ->>>      Namespace`;

    expect(dedent(input)).toBe("kind: ->>>      Namespace");
  });

  test("handles strings without leading whitespace consistently", () => {
    const input = `kind: Namespace
metadata:`;

    const inputArray = dedent(input).split(/\r?\n/);
    expect(inputArray[0]).toBe("kind: Namespace");
    expect(inputArray[1]).toBe("metadata:");
  });

  test("handles empty strings without crashing", () => {
    const input = ``;
    const expected = ``;
    expect(dedent(input)).toBe(expected);
  });
});

describe("replaceString", () => {
  test("replaces single instance of a string", () => {
    const original = "Hello, world!";
    const stringA = "world";
    const stringB = "Jest";
    const expected = "Hello, Jest!";
    expect(replaceString(original, stringA, stringB)).toBe(expected);
  });

  test("replaces multiple instances of a string", () => {
    const original = "Repeat, repeat, repeat";
    const stringA = "repeat";
    const stringB = "done";
    const expected = "Repeat, done, done";
    expect(replaceString(original, stringA, stringB)).toBe(expected);
  });

  test("does nothing if string to replace is not found", () => {
    const original = "Nothing changes here";
    const stringA = "absent";
    const stringB = "present";
    const expected = "Nothing changes here";
    expect(replaceString(original, stringA, stringB)).toBe(expected);
  });

  test("escapes special regex characters in string to be replaced", () => {
    const original = "Find the period.";
    const stringA = ".";
    const stringB = "!";
    const expected = "Find the period!";
    expect(replaceString(original, stringA, stringB)).toBe(expected);
  });

  test("replaces string with empty string if stringB is empty", () => {
    const original = "Remove this part.";
    const stringA = " this part";
    const stringB = "";
    const expected = "Remove.";
    expect(replaceString(original, stringA, stringB)).toBe(expected);
  });
});

describe("filterNoMatchReason", () => {
  it.each([
    [{}],
    [{ metadata: { namespace: "pepr-uds" } }],
    [{ metadata: { namespace: "pepr-core" } }],
    [{ metadata: { namespace: "uds-ns" } }],
    [{ metadata: { namespace: "uds" } }],
  ])(
    "given %j, it returns regex namespace filter error for Pods whose namespace does not match the regex",
    (obj: KubernetesObject) => {
      const kubernetesObject: KubernetesObject = obj.metadata
        ? {
            ...defaultKubernetesObject,
            metadata: { ...defaultKubernetesObject.metadata, namespace: obj.metadata.namespace },
          }
        : { ...defaultKubernetesObject, metadata: obj as unknown as undefined };
      const binding: Binding = {
        ...defaultBinding,
        kind: { kind: "Pod", group: "some-group" },
        filters: { ...defaultFilters, regexNamespaces: ["(.*)-system"] },
      };

      const capabilityNamespaces: string[] = [];
      const expectedErrorMessage = `Ignoring Watch Callback: Binding defines namespace regexes '["(.*)-system"]' but Object carries`;
      const result = filterNoMatchReason(binding, kubernetesObject, capabilityNamespaces);
      expect(result).toEqual(
        typeof kubernetesObject.metadata === "object" && obj !== null && Object.keys(obj).length > 0
          ? `${expectedErrorMessage} '${kubernetesObject.metadata.namespace}'.`
          : `${expectedErrorMessage} ''.`,
      );
    },
  );
});

test("returns no regex namespace filter error for Pods whos namespace does match the regex", () => {
  const binding: Binding = {
    ...defaultBinding,
    kind: { kind: "Pod", group: "some-group" },
    filters: { ...defaultFilters, regexNamespaces: ["(.*)-system"], namespaces: [] },
  };
  const obj = { metadata: { namespace: "pepr-demo" } };
  const objArray = [
    { ...obj, metadata: { namespace: "pepr-system" } },
    { ...obj, metadata: { namespace: "pepr-uds-system" } },
    { ...obj, metadata: { namespace: "uds-system" } },
    { ...obj, metadata: { namespace: "some-thing-that-is-a-system" } },
    { ...obj, metadata: { namespace: "your-system" } },
  ];
  const capabilityNamespaces: string[] = [];
  objArray.map(object => {
    const result = filterNoMatchReason(binding, object as unknown as Partial<KubernetesObject>, capabilityNamespaces);
    expect(result).toEqual(``);
  });
});

// Names Fail
test("returns regex name filter error for Pods whos name does not match the regex", () => {
  const binding: Binding = {
    ...defaultBinding,
    kind: { kind: "Pod", group: "some-group" },
    filters: { ...defaultFilters, regexName: "^system", namespaces: [] },
  };
  const obj = { metadata: { name: "pepr-demo" } };
  const objArray = [
    { ...obj },
    { ...obj, metadata: { name: "pepr-uds" } },
    { ...obj, metadata: { name: "pepr-core" } },
    { ...obj, metadata: { name: "uds-ns" } },
    { ...obj, metadata: { name: "uds" } },
  ];
  const capabilityNamespaces: string[] = [];
  objArray.map(object => {
    const result = filterNoMatchReason(binding, object as unknown as Partial<KubernetesObject>, capabilityNamespaces);
    expect(result).toEqual(
      `Ignoring Watch Callback: Binding defines name regex '^system' but Object carries '${object?.metadata?.name}'.`,
    );
  });
});

// Names Pass
test("returns no regex name filter error for Pods whos name does match the regex", () => {
  const binding: Binding = {
    ...defaultBinding,
    kind: { kind: "Pod", group: "some-group" },
    filters: { ...defaultFilters, regexName: "^system" },
  };
  const obj = { metadata: { name: "pepr-demo" } };
  const objArray = [
    { ...obj, metadata: { name: "systemd" } },
    { ...obj, metadata: { name: "systemic" } },
    { ...obj, metadata: { name: "system-of-kube-apiserver" } },
    { ...obj, metadata: { name: "system" } },
    { ...obj, metadata: { name: "system-uds" } },
  ];
  const capabilityNamespaces: string[] = [];
  objArray.map(object => {
    const result = filterNoMatchReason(binding, object as unknown as Partial<KubernetesObject>, capabilityNamespaces);
    expect(result).toEqual(``);
  });
});

test("returns missingCarriableNamespace filter error for cluster-scoped objects when capability namespaces are present", () => {
  const binding: Binding = {
    ...defaultBinding,
    kind: { kind: "ClusterRole", group: "some-group" },
  };
  const obj = {
    kind: "ClusterRole",
    apiVersion: "rbac.authorization.k8s.io/v1",
    metadata: { name: "clusterrole1" },
  };
  const capabilityNamespaces: string[] = ["monitoring"];
  const result = filterNoMatchReason(binding, obj as unknown as Partial<KubernetesObject>, capabilityNamespaces);
  expect(result).toEqual(
    "Ignoring Watch Callback: Object does not carry a namespace but namespaces allowed by Capability are '[\"monitoring\"]'.",
  );
});

test("returns mismatchedNamespace filter error for clusterScoped objects with namespace filters", () => {
  const binding: Binding = {
    ...defaultBinding,
    kind: { kind: "ClusterRole", group: "some-group" },
    filters: { ...defaultFilters, namespaces: ["ns1"] },
  };
  const obj = {
    kind: "ClusterRole",
    apiVersion: "rbac.authorization.k8s.io/v1",
    metadata: { name: "clusterrole1" },
  };
  const capabilityNamespaces: string[] = [];
  const result = filterNoMatchReason(binding, obj as unknown as Partial<KubernetesObject>, capabilityNamespaces);
  expect(result).toEqual("Ignoring Watch Callback: Binding defines namespaces '[\"ns1\"]' but Object carries ''.");
});

test("returns namespace filter error for namespace objects with namespace filters", () => {
  const binding: Binding = {
    ...defaultBinding,
    kind: { kind: "Namespace", group: "some-group" },
    filters: { ...defaultFilters, namespaces: ["ns1"] },
  };
  const obj = {};
  const capabilityNamespaces: string[] = [];
  const result = filterNoMatchReason(binding, obj as unknown as Partial<KubernetesObject>, capabilityNamespaces);
  expect(result).toEqual("Ignoring Watch Callback: Cannot use namespace filter on a namespace object.");
});

test("return an Ignoring Watch Callback string if the binding name and object name are different", () => {
  const binding: Binding = {
    ...defaultBinding,
    filters: { ...defaultFilters, name: "pepr" },
  };
  const obj = {
    metadata: {
      name: "not-pepr",
    },
  };
  const capabilityNamespaces: string[] = [];
  const result = filterNoMatchReason(binding, obj as unknown as Partial<KubernetesObject>, capabilityNamespaces);
  expect(result).toEqual(`Ignoring Watch Callback: Binding defines name 'pepr' but Object carries 'not-pepr'.`);
});
test("returns no Ignoring Watch Callback string if the binding name and object name are the same", () => {
  const binding: Binding = {
    ...defaultBinding,
    filters: { ...defaultFilters, name: "pepr" },
  };
  const obj = {
    metadata: { name: "pepr" },
  };
  const capabilityNamespaces: string[] = [];
  const result = filterNoMatchReason(binding, obj as unknown as Partial<KubernetesObject>, capabilityNamespaces);
  expect(result).toEqual("");
});

test("return deletionTimestamp error when there is no deletionTimestamp in the object", () => {
  const binding: Binding = {
    ...defaultBinding,
    filters: { ...defaultFilters, deletionTimestamp: true },
  };
  const obj = {
    metadata: {},
  };
  const capabilityNamespaces: string[] = [];
  const result = filterNoMatchReason(binding, obj as unknown as Partial<KubernetesObject>, capabilityNamespaces);
  expect(result).toEqual("Ignoring Watch Callback: Binding defines deletionTimestamp but Object does not carry it.");
});

test("return no deletionTimestamp error when there is a deletionTimestamp in the object", () => {
  const binding: Binding = {
    ...defaultBinding,
    filters: { ...defaultFilters, deletionTimestamp: true },
  };
  const obj = {
    metadata: {
      deletionTimestamp: "2021-01-01T00:00:00Z",
    },
  };
  const capabilityNamespaces: string[] = [];
  const result = filterNoMatchReason(binding, obj as unknown as Partial<KubernetesObject>, capabilityNamespaces);
  expect(result).not.toEqual("Ignoring Watch Callback: Binding defines deletionTimestamp Object does not carry it.");
});

test("returns label overlap error when there is no overlap between binding and object labels", () => {
  const binding: Binding = {
    ...defaultBinding,
    filters: { ...defaultFilters, labels: { key: "value" } },
  };
  const obj = {
    metadata: { labels: { anotherKey: "anotherValue" } },
  };
  const capabilityNamespaces: string[] = [];
  const result = filterNoMatchReason(binding, obj as unknown as Partial<KubernetesObject>, capabilityNamespaces);
  expect(result).toEqual(
    `Ignoring Watch Callback: Binding defines labels '{"key":"value"}' but Object carries '{"anotherKey":"anotherValue"}'.`,
  );
});

test("returns annotation overlap error when there is no overlap between binding and object annotations", () => {
  const binding: Binding = {
    ...defaultBinding,
    filters: { ...defaultFilters, annotations: { key: "value" } },
  };
  const obj = {
    metadata: { annotations: { anotherKey: "anotherValue" } },
  };
  const capabilityNamespaces: string[] = [];
  const result = filterNoMatchReason(binding, obj as unknown as Partial<KubernetesObject>, capabilityNamespaces);
  expect(result).toEqual(
    `Ignoring Watch Callback: Binding defines annotations '{"key":"value"}' but Object carries '{"anotherKey":"anotherValue"}'.`,
  );
});

test("returns capability namespace error when object is not in capability namespaces", () => {
  const binding: Binding = {
    model: kind.Pod,
    event: Event.ANY,
    kind: {
      group: "",
      version: "v1",
      kind: "Pod",
    },
    filters: {
      name: "bleh",
      namespaces: [],
      regexNamespaces: [],
      regexName: "",
      labels: {},
      annotations: {},
      deletionTimestamp: false,
    },
    watchCallback: callback,
  };

  const obj = {
    metadata: { namespace: "ns2", name: "bleh" },
  };
  const capabilityNamespaces = ["ns1"];
  const result = filterNoMatchReason(
    binding as Binding,
    obj as unknown as Partial<KubernetesObject>,
    capabilityNamespaces,
  );
  expect(result).toEqual(
    `Ignoring Watch Callback: Object carries namespace 'ns2' but namespaces allowed by Capability are '["ns1"]'.`,
  );
});

test("returns binding namespace error when filter namespace is not part of capability namespaces", () => {
  const binding: Binding = {
    ...defaultBinding,
    filters: { ...defaultFilters, namespaces: ["ns3"], regexNamespaces: [] },
  };
  const obj = {};
  const capabilityNamespaces = ["ns1", "ns2"];
  const result = filterNoMatchReason(binding, obj as unknown as Partial<KubernetesObject>, capabilityNamespaces);
  expect(result).toEqual(
    `Ignoring Watch Callback: Binding defines namespaces ["ns3"] but namespaces allowed by Capability are '["ns1","ns2"]'.`,
  );
});

test("returns binding and object namespace error when they do not overlap", () => {
  const binding: Binding = {
    ...defaultBinding,
    filters: { ...defaultFilters, namespaces: ["ns1"], regexNamespaces: [] },
  };
  const obj = {
    metadata: { namespace: "ns2" },
  };
  const capabilityNamespaces = ["ns1", "ns2"];
  const result = filterNoMatchReason(binding, obj as unknown as Partial<KubernetesObject>, capabilityNamespaces);
  expect(result).toEqual(`Ignoring Watch Callback: Binding defines namespaces '["ns1"]' but Object carries 'ns2'.`);
});

test("return watch violation message when object is in an ignored namespace", () => {
  const binding: Binding = {
    ...defaultBinding,
    filters: { ...defaultFilters, namespaces: ["ns3"] },
  };
  const obj = {
    metadata: { namespace: "ns3" },
  };
  const capabilityNamespaces = ["ns3"];
  const ignoredNamespaces = ["ns3"];
  const result = filterNoMatchReason(
    binding,
    obj as unknown as Partial<KubernetesObject>,
    capabilityNamespaces,
    ignoredNamespaces,
  );
  expect(result).toEqual(
    `Ignoring Watch Callback: Object carries namespace 'ns3' but ignored namespaces include '["ns3"]'.`,
  );
});

test("returns empty string when all checks pass", () => {
  const binding: Binding = {
    ...defaultBinding,
    filters: { ...defaultFilters, namespaces: ["ns1"], labels: { key: "value" }, annotations: { key: "value" } },
  };
  const obj = {
    metadata: { namespace: "ns1", labels: { key: "value" }, annotations: { key: "value" } },
  };
  const capabilityNamespaces = ["ns1"];
  const result = filterNoMatchReason(binding, obj as unknown as Partial<KubernetesObject>, capabilityNamespaces);
  expect(result).toEqual("");
});

describe("validateHash", () => {
  let originalExit: (code?: number) => never;

  beforeEach(() => {
    originalExit = process.exit;
    process.exit = jest.fn() as unknown as (code?: number) => never;
  });

  afterEach(() => {
    process.exit = originalExit;
  });
  test("should throw ValidationError for invalid hash values", () => {
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

  test("should not throw ValidationError for valid SHA-256 hash", () => {
    // Example of a valid SHA-256 hash
    const validHash = "abc123def456abc123def456abc123def456abc123def456abc123def456abc1";
    expect(() => validateHash(validHash)).not.toThrow();
  });
});

describe("matchesRegex", () => {
  test("should return true for a valid pattern that matches the string", () => {
    const pattern = "abc";
    const testString = "abc123";
    const result = matchesRegex(pattern, testString);
    expect(result).toBe(true);
  });

  test("should return false for a valid pattern that does not match the string", () => {
    const pattern = "xyz";
    const testString = "abc123";
    const result = matchesRegex(pattern, testString);
    expect(result).toBe(false);
  });

  test("should return false for an invalid regex pattern", () => {
    const invalidPattern = "^p"; // Invalid regex with unclosed bracket
    const testString = "test";
    const result = matchesRegex(invalidPattern, testString);
    expect(result).toBe(false);
  });

  test("should return true for an empty string matching an empty regex", () => {
    const pattern = "";
    const testString = "";
    const result = matchesRegex(pattern, testString);
    expect(result).toBe(true);
  });

  test("should return false for an empty string and a non-empty regex", () => {
    const pattern = "abc";
    const testString = "";
    const result = matchesRegex(pattern, testString);
    expect(result).toBe(false);
  });

  test("should return true for a complex valid regex that matches", () => {
    const pattern = "^[a-zA-Z0-9]+@[a-zA-Z0-9]+.[A-Za-z]+$";
    const testString = "test@example.com";
    const result = matchesRegex(pattern, testString);
    expect(result).toBe(true);
  });

  test("should return false for a complex valid regex that does not match", () => {
    const pattern = "^[a-zA-Z0-9]+@[a-zA-Z0-9]+.[A-Za-z]+$";
    const testString = "invalid-email.com";
    const result = matchesRegex(pattern, testString);
    expect(result).toBe(false);
  });
});
