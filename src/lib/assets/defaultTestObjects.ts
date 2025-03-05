import { GenericClass } from "kubernetes-fluent-client";
import { Event } from "../enums";
import { Binding, CapabilityExport } from "../types";
import { defaultFilters } from "../filter/adjudicators/defaultTestObjects";
import { V1PolicyRule as PolicyRule } from "@kubernetes/client-node";

export const createMockRbacRule = (
  apiGroups: string[] = ["pepr.dev"],
  resources: string[] = ["peprstores"],
  verbs: string[] = ["create", "get", "patch", "watch"],
): PolicyRule => ({
  apiGroups,
  resources,
  verbs,
});

/* eslint-disable max-params */
export const createMockBinding = (
  group: string = "pepr.dev",
  version: string = "v1",
  kind: string = "peprstore",
  plural: string = "peprstores",
  isWatch: boolean = false,
  event: Event = Event.CREATE,
  isFinalize?: boolean,
): Binding => {
  return {
    kind: { group, version, kind, plural },
    isWatch,
    ...(isFinalize !== undefined && { isFinalize }),
    event,
    model: {} as GenericClass,
    filters: { ...defaultFilters, regexName: "" },
  };
};
/* eslint-enable max-params */

export const createMockCapability = (
  rbacRules = [createMockRbacRule()],
  bindings = [createMockBinding()],
): CapabilityExport => ({
  name: "",
  hasSchedule: false,
  description: "",
  rbac: rbacRules,
  bindings,
});

export const mockCapabilitiesOld: CapabilityExport[] = [
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

export const mockCapabilitiesNew: CapabilityExport[] = [
  createMockCapability(),
  createMockCapability(
    [createMockRbacRule(["apiextensions.k8s.io"], ["customresourcedefinitions"], ["patch", "create"])],
    [
      createMockBinding(
        "apiextensions.k8s.io",
        "v1",
        "customresourcedefinition",
        "customresourcedefinitions",
        false,
        Event.CREATE,
        false,
      ),
    ],
  ),
  createMockCapability(
    [createMockRbacRule([""], ["namespaces"], ["watch"])],
    [createMockBinding("", "v1", "namespace", "namespaces", true, Event.CREATE, false)],
  ),
  createMockCapability(
    [createMockRbacRule([""], ["configmaps"], ["watch"])],
    [createMockBinding("", "v1", "configmap", "configmaps", true, Event.CREATE, false)],
  ),
];

export const capabilitiesWithFinalize: CapabilityExport[] = [
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

export const newCapabilityWithFinalize: CapabilityExport[] = [
  createMockCapability(
    [createMockRbacRule(["pepr.dev"], ["peprstores"], ["patch"])],
    [createMockBinding("pepr.dev", "v1", "peprstore", "peprstores", false, Event.CREATE, true)],
  ),
];

export const capabilitiesWithDuplicates: CapabilityExport[] = [
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

export const capabilitiesWithShortKey: CapabilityExport[] = [
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

export const capabilitiesWithLongKey: CapabilityExport[] = [
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
