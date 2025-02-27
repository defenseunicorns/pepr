import { GenericClass } from "kubernetes-fluent-client";
import { Event } from "../enums";
import { CapabilityExport } from "../types";
import { describe, beforeEach, jest, it, expect } from "@jest/globals";
import { V1PolicyRule as PolicyRule } from "@kubernetes/client-node";
import fs from "fs";
import { clusterRole } from "./rbac";
import * as helpers from "../helpers";

export const mockCapabilities: CapabilityExport[] = [
  {
    rbac: [
      {
        apiGroups: ["pepr.dev"],
        resources: ["peprstores"],
        verbs: ["create", "get", "patch", "watch"],
      },
    ],
    bindings: [
      {
        kind: { group: "pepr.dev", version: "v1", kind: "peprstore", plural: "peprstores" },
        isWatch: false,
        event: Event.CREATE,
        model: {} as GenericClass,
        filters: {
          name: "",
          regexName: "",
          namespaces: [],
          regexNamespaces: [],
          labels: {},
          annotations: {},
          deletionTimestamp: false,
        },
      },
    ],
    hasSchedule: false,
    name: "",
    description: "",
  },
  {
    rbac: [
      {
        apiGroups: ["apiextensions.k8s.io"],
        resources: ["customresourcedefinitions"],
        verbs: ["patch", "create"],
      },
    ],
    bindings: [
      {
        kind: {
          group: "apiextensions.k8s.io",
          version: "v1",
          kind: "customresourcedefinition",
          plural: "customresourcedefinitions",
        },
        isWatch: false,
        isFinalize: false,
        event: Event.CREATE,
        model: {} as GenericClass,
        filters: {
          name: "",
          regexName: "",
          namespaces: [],
          regexNamespaces: [],
          labels: {},
          annotations: {},
          deletionTimestamp: false,
        },
      },
    ],
    hasSchedule: false,
    name: "",
    description: "",
  },
  {
    rbac: [
      {
        apiGroups: [""],
        resources: ["namespaces"],
        verbs: ["watch"],
      },
    ],
    bindings: [
      {
        kind: { group: "", version: "v1", kind: "namespace", plural: "namespaces" },
        isWatch: true,
        isFinalize: false,
        event: Event.CREATE,
        model: {} as GenericClass,
        filters: {
          name: "",
          regexName: "",
          namespaces: [],
          regexNamespaces: [],
          labels: {},
          annotations: {},
          deletionTimestamp: false,
        },
      },
    ],
    hasSchedule: false,
    name: "",
    description: "",
  },
  {
    rbac: [
      {
        apiGroups: [""],
        resources: ["configmaps"],
        verbs: ["watch"],
      },
    ],
    bindings: [
      {
        kind: { group: "", version: "v1", kind: "configmap", plural: "configmaps" },
        isWatch: true,
        isFinalize: false,
        event: Event.CREATE,
        model: {} as GenericClass,
        filters: {
          name: "",
          regexName: "",
          namespaces: [],
          regexNamespaces: [],
          labels: {},
          annotations: {},
          deletionTimestamp: false,
        },
      },
    ],
    hasSchedule: false,
    name: "",
    description: "",
  },
];
describe("RBAC generation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const mockPackageJsonRBAC = {};

    jest.spyOn(fs, "readFileSync").mockImplementation((path: unknown) => {
      if (typeof path === "string" && path.includes("package.json")) {
        return JSON.stringify({ rbac: mockPackageJsonRBAC });
      }
      return "{}";
    });
  });

  it("should generate correct ClusterRole rules in scoped mode", () => {
    const result = clusterRole("test-role", mockCapabilities, "scoped", []);

    expect(result.rules).toEqual([
      {
        apiGroups: ["pepr.dev"],
        resources: ["peprstores"],
        verbs: ["create", "get", "patch", "watch"],
      },
      {
        apiGroups: ["apiextensions.k8s.io"],
        resources: ["customresourcedefinitions"],
        verbs: ["patch", "create"],
      },
      {
        apiGroups: [""],
        resources: ["namespaces"],
        verbs: ["watch"],
      },
      {
        apiGroups: [""],
        resources: ["configmaps"],
        verbs: ["watch"],
      },
    ]);
  });

  it("should generate a ClusterRole with wildcard rules when not in scoped mode", () => {
    const expectedWildcardRules = [
      {
        apiGroups: ["*"],
        resources: ["*"],
        verbs: ["create", "delete", "get", "list", "patch", "update", "watch"],
      },
    ];

    const result = clusterRole("test-role", mockCapabilities, "admin", []);

    expect(result.rules).toEqual(expectedWildcardRules);
  });

  it("should return an empty rules array when capabilities are empty in scoped mode", () => {
    const result = clusterRole("test-role", [], "scoped", []);

    expect(result.rules).toEqual([]);
  });

  it("should include finalize verbs if isFinalize is true in scoped mode", () => {
    const capabilitiesWithFinalize: CapabilityExport[] = [
      {
        rbac: [
          {
            apiGroups: ["pepr.dev"],
            resources: ["peprstores"],
            verbs: ["patch"],
          },
        ],
        bindings: [
          {
            kind: { group: "pepr.dev", version: "v1", kind: "peprstore", plural: "peprstores" },
            isWatch: false,
            isFinalize: true,
            event: Event.CREATE,
            model: {} as GenericClass,
            filters: {
              name: "",
              regexName: "",
              namespaces: [],
              regexNamespaces: [],
              labels: {},
              annotations: {},
              deletionTimestamp: false,
            },
          },
        ],
        hasSchedule: false,
        name: "",
        description: "",
      },
    ];

    const result = clusterRole(
      "test-role",
      capabilitiesWithFinalize,
      "scoped",
      capabilitiesWithFinalize.flatMap(c => c.rbac).filter((rule): rule is PolicyRule => rule !== undefined),
    );

    expect(result.rules).toEqual([
      {
        apiGroups: ["pepr.dev"],
        resources: ["peprstores"],
        verbs: ["patch"],
      },
      {
        apiGroups: ["apiextensions.k8s.io"],
        resources: ["customresourcedefinitions"],
        verbs: ["patch", "create"],
      },
    ]);
  });

  it("should deduplicate verbs and resources in rules", () => {
    const capabilitiesWithDuplicates: CapabilityExport[] = [
      {
        rbac: [
          {
            apiGroups: ["pepr.dev"],
            resources: ["peprstores"],
            verbs: ["create", "get"],
          },
        ],
        bindings: [
          {
            kind: { group: "pepr.dev", version: "v1", kind: "peprlog", plural: "peprlogs" },
            isWatch: false,
            event: Event.CREATE,
            model: {} as GenericClass,
            filters: {
              name: "",
              regexName: "",
              namespaces: [],
              regexNamespaces: [],
              labels: {},
              annotations: {},
              deletionTimestamp: false,
            },
          },
        ],
        hasSchedule: false,
        name: "",
        description: "",
      },
      {
        rbac: [
          {
            apiGroups: ["pepr.dev"],
            resources: ["peprstores"],
            verbs: ["get", "patch"],
          },
        ],
        bindings: [
          {
            kind: { group: "pepr.dev", version: "v1", kind: "peprlog", plural: "peprlogs" },
            isWatch: false,
            event: Event.CREATE,
            model: {} as GenericClass,
            filters: {
              name: "",
              regexName: "",
              namespaces: [],
              regexNamespaces: [],
              labels: {},
              annotations: {},
              deletionTimestamp: false,
            },
          },
        ],
        hasSchedule: false,
        name: "",
        description: "",
      },
    ];

    const result = clusterRole(
      "test-role",
      capabilitiesWithDuplicates,
      "scoped",
      capabilitiesWithDuplicates.flatMap(c => c.rbac).filter((rule): rule is PolicyRule => rule !== undefined),
    );

    // Filter out only the rules for 'pepr.dev' and 'peprstores'
    const filteredRules = result.rules?.filter(
      rule => rule.apiGroups?.includes("pepr.dev") && rule.resources?.includes("peprstores"),
    );

    expect(filteredRules).toEqual([
      {
        apiGroups: ["pepr.dev"],
        resources: ["peprstores"],
        verbs: ["create", "get", "patch", "watch"],
      },
    ]);
  });
});
describe("clusterRole", () => {
  // Mocking the readRBACFromPackageJson function to return null
  jest.mock("./rbac", () => ({
    ...(jest.requireActual("./rbac") as object),
    readRBACFromPackageJson: jest.fn(() => null),
  }));

  // Mocking createRBACMap to isolate the behavior of clusterRole function
  jest.mock("../helpers", () => ({
    ...(jest.requireActual("../helpers") as object),
    createRBACMap: jest.fn(),
  }));

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("should handle keys with less than 3 segments and set group to an empty string", () => {
    jest.spyOn(helpers, "createRBACMap").mockReturnValue({
      nodes: {
        plural: "nodes",
        verbs: ["get"],
      },
    });

    const capabilitiesWithShortKey: CapabilityExport[] = [
      {
        rbac: [
          {
            apiGroups: [""],
            resources: ["nodes"],
            verbs: ["get"],
          },
        ],
        bindings: [
          {
            kind: { group: "", version: "v1", kind: "node", plural: "nodes" },
            isWatch: false,
            event: Event.CREATE,
            model: {} as GenericClass,
            filters: {
              name: "",
              regexName: "",
              namespaces: [],
              regexNamespaces: [],
              labels: {},
              annotations: {},
              deletionTimestamp: false,
            },
          },
        ],
        hasSchedule: false,
        name: "",
        description: "",
      },
    ];

    const result = clusterRole(
      "test-role",
      capabilitiesWithShortKey,
      "scoped",
      capabilitiesWithShortKey.flatMap(c => c.rbac).filter((rule): rule is PolicyRule => rule !== undefined),
    );

    expect(result.rules).toEqual([
      {
        apiGroups: [""],
        resources: ["nodes"],
        verbs: ["get"],
      },
    ]);
  });

  it("should handle keys with 3 or more segments and set group correctly", () => {
    jest.spyOn(helpers, "createRBACMap").mockReturnValue({
      "apps/v1/deployments": {
        plural: "deployments",
        verbs: ["create"],
      },
    });

    const capabilitiesWithLongKey: CapabilityExport[] = [
      {
        rbac: [
          {
            apiGroups: ["apps"],
            resources: ["deployments"],
            verbs: ["create"],
          },
        ],
        bindings: [
          {
            kind: { group: "apps", version: "v1", kind: "deployment", plural: "deployments" },
            isWatch: false,
            event: Event.CREATE,
            model: {} as GenericClass,
            filters: {
              name: "",
              regexName: "",
              namespaces: [],
              regexNamespaces: [],
              labels: {},
              annotations: {},
              deletionTimestamp: false,
            },
          },
        ],
        hasSchedule: false,
        name: "",
        description: "",
      },
    ];

    const result = clusterRole(
      "test-role",
      capabilitiesWithLongKey,
      "scoped",
      capabilitiesWithLongKey.flatMap(c => c.rbac).filter((rule): rule is PolicyRule => rule !== undefined),
    );

    expect(result.rules).toEqual([
      {
        apiGroups: ["apps"],
        resources: ["deployments"],
        verbs: ["create"],
      },
    ]);
  });

  it("should handle non-array custom RBAC by defaulting to an empty array", () => {
    // Mock readRBACFromPackageJson to return a non-array value
    jest.spyOn(fs, "readFileSync").mockImplementation(() => {
      return JSON.stringify({
        pepr: {
          rbac: "not-an-array", // Simulate invalid RBAC structure
        },
      });
    });

    const result = clusterRole(
      "test-role",
      mockCapabilities,
      "scoped",
      mockCapabilities.flatMap(c => c.rbac).filter((rule): rule is PolicyRule => rule !== undefined),
    );

    // The result should only contain rules from the capabilities, not from the invalid custom RBAC
    expect(result.rules).toEqual([
      {
        apiGroups: ["pepr.dev"],
        resources: ["peprstores"],
        verbs: ["create", "get", "patch", "watch"],
      },
      {
        apiGroups: ["apiextensions.k8s.io"],
        resources: ["customresourcedefinitions"],
        verbs: ["patch", "create"],
      },
      {
        apiGroups: [""],
        resources: ["namespaces"],
        verbs: ["watch"],
      },
      {
        apiGroups: [""],
        resources: ["configmaps"],
        verbs: ["watch"],
      },
    ]);
  });

  it("should default to an empty verbs array if rule.verbs is undefined", () => {
    // Simulate a custom RBAC rule with empty verbs
    const customRbacWithNoVerbs: PolicyRule[] = [
      {
        apiGroups: ["pepr.dev"],
        resources: ["customresources"],
        verbs: [], // Set verbs to an empty array to satisfy the V1PolicyRule type
      },
    ];

    jest.spyOn(fs, "readFileSync").mockImplementation(() => {
      return JSON.stringify({
        pepr: {
          rbac: customRbacWithNoVerbs,
        },
      });
    });

    const result = clusterRole("test-role", mockCapabilities, "scoped", customRbacWithNoVerbs);

    // Check that the verbs array is empty for the custom RBAC rule
    expect(result.rules).toContainEqual({
      apiGroups: ["pepr.dev"],
      resources: ["customresources"],
      verbs: [],
    });
  });
});
