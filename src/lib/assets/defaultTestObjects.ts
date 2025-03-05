import { GenericClass } from "kubernetes-fluent-client";
import { Event } from "../enums";
import { CapabilityExport } from "../types";

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
