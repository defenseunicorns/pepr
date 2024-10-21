// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { clusterRole } from "./rbac"; // Adjust the import to your actual file path
import { CapabilityExport } from "../types";
import { it, describe, expect, beforeEach, jest } from "@jest/globals";
import { GenericClass } from "kubernetes-fluent-client";
import { Event } from "../types";
import fs from "fs";

const mockCapabilities: CapabilityExport[] = [
  {
    apiGroups: ["pepr.dev"],
    resources: ["peprstores"],
    verbs: ["create", "get", "patch", "watch"],
    bindings: [
      {
        kind: { group: "pepr.dev", version: "v1", kind: "peprstore", plural: "peprstores" },
        isWatch: false,
        event: Event.Create,
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
    apiGroups: ["apiextensions.k8s.io"],
    resources: ["customresourcedefinitions"],
    verbs: ["patch", "create"],
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
        event: Event.Create,
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
    apiGroups: [""],
    resources: ["namespaces"],
    verbs: ["watch"],
    bindings: [
      {
        kind: { group: "", version: "v1", kind: "namespace", plural: "namespaces" },
        isWatch: true,
        isFinalize: false,
        event: Event.Create,
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
    apiGroups: [""],
    resources: ["configmaps"],
    verbs: ["watch"],
    bindings: [
      {
        kind: { group: "", version: "v1", kind: "configmap", plural: "configmaps" },
        isWatch: true,
        isFinalize: false,
        event: Event.Create,
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
    const result = clusterRole("test-role", mockCapabilities, "scoped");

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

    const result = clusterRole("test-role", mockCapabilities);

    expect(result.rules).toEqual(expectedWildcardRules);
  });

  it("should return an empty rules array when capabilities are empty in scoped mode", () => {
    const result = clusterRole("test-role", [], "scoped");

    expect(result.rules).toEqual([]);
  });

  it("should include finalize verbs if isFinalize is true in scoped mode", () => {
    const capabilitiesWithFinalize: CapabilityExport[] = [
      {
        apiGroups: ["pepr.dev"],
        resources: ["peprstores"],
        verbs: ["patch"],
        bindings: [
          {
            kind: { group: "pepr.dev", version: "v1", kind: "peprstore", plural: "peprstores" },
            isWatch: false,
            isFinalize: true,
            event: Event.Create,
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

    const result = clusterRole("test-role", capabilitiesWithFinalize, "scoped");

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

  /* const duplicateApiGroupCapabilities: CapabilityExport[] = [
    {
      apiGroups: ['pepr.dev'],
      resources: ['peprstores'],
      verbs: ['create'],
      bindings: [
        {
          kind: { group: 'pepr.dev', version: 'v1', kind: 'peprstore', plural: 'peprstores' },
          isWatch: false,
          event: Event.Create,
          model: {} as GenericClass,
          filters: {
            name: '',
            regexName: '',
            namespaces: [],
            regexNamespaces: [],
            labels: {},
            annotations: {},
            deletionTimestamp: false
          }
        },
      ],
      hasSchedule: false,
      name: '',
      description: ''
    },
    {
      apiGroups: ['pepr.dev'],
      resources: ['peprlogs'],
      verbs: ['get', 'list'],
      bindings: [
        {
          kind: { group: 'pepr.dev', version: 'v1', kind: 'peprlog', plural: 'peprlogs' },
          isWatch: false,
          event: Event.Create,
          model: {} as GenericClass,
          filters: {
            name: '',
            regexName: '',
            namespaces: [],
            regexNamespaces: [],
            labels: {},
            annotations: {},
            deletionTimestamp: false
          }
        },
      ],
      hasSchedule: false,
      name: '',
      description: ''
    }
  ]; */

  /*   it('should deduplicate verbs and resources in rules', () => {
    const capabilitiesWithDuplicates: CapabilityExport[] = [
      {
        apiGroups: ['pepr.dev'],
        resources: ['peprstores'],
        verbs: ['create', 'get'],
        bindings: [
          {
            kind: { group: 'pepr.dev', version: 'v1', kind: 'peprlog', plural: 'peprlogs' },
            isWatch: false,
            event: Event.Create,
            model: {} as GenericClass,
            filters: {
              name: '',
              regexName: '',
              namespaces: [],
              regexNamespaces: [],
              labels: {},
              annotations: {},
              deletionTimestamp: false
            }
          },
        ],
        hasSchedule: false,
        name: '',
        description: ''
      },
      {
        apiGroups: ['pepr.dev'],
        resources: ['peprstores'],
        verbs: ['get', 'patch'],
        bindings: [
          {
            kind: { group: 'pepr.dev', version: 'v1', kind: 'peprlog', plural: 'peprlogs' },
            isWatch: false,
            event: Event.Create,
            model: {} as GenericClass,
            filters: {
              name: '',
              regexName: '',
              namespaces: [],
              regexNamespaces: [],
              labels: {},
              annotations: {},
              deletionTimestamp: false
            }
          },
        ],
        hasSchedule: false,
        name: '',
        description: ''
      }
    ];

    const result = clusterRole('test-role', capabilitiesWithDuplicates, 'scoped');

    expect(result.rules).toEqual([
      {
        apiGroups: ['pepr.dev'],
        resources: ['peprstores'],
        verbs: ['create', 'get', 'patch'],
      },
    ]);
  }); */
});

describe("RBAC generation with mocked package.json", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const mockPackageJsonRBAC = [
      {
        apiGroups: ["pepr.dev"],
        resources: ["pods"],
        verbs: ["get", "list"],
      },
      {
        apiGroups: ["apps"],
        resources: ["deployments"],
        verbs: ["create", "delete"],
      },
    ];

    jest.spyOn(fs, "readFileSync").mockImplementation((path: unknown) => {
      if (typeof path === "string" && path.includes("package.json")) {
        return JSON.stringify({ rbac: mockPackageJsonRBAC });
      }
      return "{}";
    });
  });

  it("should merge and deduplicate rules from capabilities and custom RBAC in scoped mode", () => {
    const result = clusterRole("test-role", mockCapabilities, "scoped");

    expect(result.rules).toEqual([
      {
        apiGroups: ["pepr.dev"],
        resources: ["pods"],
        verbs: ["get", "list"],
      },
      {
        apiGroups: ["apps"],
        resources: ["deployments"],
        verbs: ["create", "delete"],
      },
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

    const result = clusterRole("test-role", mockCapabilities);

    expect(result.rules).toEqual(expectedWildcardRules);
  });
});
