import { GenericClass, GroupVersionKind } from "kubernetes-fluent-client";
import { Event } from "../enums";
import { Binding, CapabilityExport } from "../types";
import { defaultFilters } from "../filter/adjudicators/defaultTestObjects";
import { V1PolicyRule as PolicyRule } from "@kubernetes/client-node";
import { AdmissionRequest, GroupVersionResource } from "../types";
import { Operation } from "../enums";

export const createMockAdmissionRequest = (
  kind: GroupVersionKind = { kind: "kind", group: "group", version: "version" },
  resource: GroupVersionResource = { group: "group", version: "version", resource: "resource" },
  object: { metadata: { name: string } } = { metadata: { name: "create-me" } },
  operation: Operation = Operation.CREATE,
): AdmissionRequest => ({
  uid: "uid",
  kind,
  resource,
  name: "",
  object,
  operation,
  userInfo: {},
});

export const createMockRbacRule = (
  apiGroups: string[] = ["pepr.dev"],
  resources: string[] = ["peprstores"],
  verbs: string[] = ["create", "get", "patch", "watch"],
): PolicyRule => ({
  apiGroups,
  resources,
  verbs,
});

export const createMockBinding = (
  kindDetails: { group?: string; version?: string; kind?: string; plural?: string } = {},
  options: { isWatch?: boolean; event?: Event; isFinalize?: boolean } = {},
): Binding => {
  const { group = "pepr.dev", version = "v1", kind = "peprstore", plural = "peprstores" } = kindDetails;

  const { isWatch = false, event = Event.CREATE, isFinalize } = options;

  return {
    kind: { group, version, kind, plural },
    isWatch,
    ...(isFinalize !== undefined && { isFinalize }),
    event,
    model: {} as GenericClass,
    filters: { ...defaultFilters, regexName: "" },
  };
};

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

export const mockCapabilities: CapabilityExport[] = [
  createMockCapability(),
  createMockCapability(
    [createMockRbacRule(["apiextensions.k8s.io"], ["customresourcedefinitions"], ["patch", "create"])],
    [
      createMockBinding(
        {
          group: "apiextensions.k8s.io",
          version: "v1",
          kind: "customresourcedefinition",
          plural: "customresourcedefinitions",
        },
        { isWatch: false, event: Event.CREATE, isFinalize: false },
      ),
    ],
  ),
  createMockCapability(
    [createMockRbacRule([""], ["namespaces"], ["watch"])],
    [
      createMockBinding(
        { group: "", version: "v1", kind: "namespace", plural: "namespaces" },
        { isWatch: true, event: Event.CREATE, isFinalize: false },
      ),
    ],
  ),
  createMockCapability(
    [createMockRbacRule([""], ["configmaps"], ["watch"])],
    [
      createMockBinding(
        { group: "", version: "v1", kind: "configmap", plural: "configmaps" },
        { isWatch: true, event: Event.CREATE, isFinalize: false },
      ),
    ],
  ),
];

export const capabilityWithFinalize: CapabilityExport[] = [
  createMockCapability(
    [createMockRbacRule(["pepr.dev"], ["peprstores"], ["patch"])],
    [
      createMockBinding(
        { group: "pepr.dev", version: "v1", kind: "peprstore", plural: "peprstores" },
        { isWatch: false, event: Event.CREATE, isFinalize: true },
      ),
    ],
  ),
];

export const capabilityWithDuplicates: CapabilityExport[] = [
  createMockCapability(
    [createMockRbacRule(["pepr.dev"], ["peprstores"], ["create", "get"])],
    [
      createMockBinding(
        { group: "pepr.dev", version: "v1", kind: "peprlog", plural: "peprlogs" },
        { isWatch: false, event: Event.CREATE },
      ),
    ],
  ),
  createMockCapability(
    [createMockRbacRule(["pepr.dev"], ["peprstores"], ["get", "patch"])],
    [
      createMockBinding(
        { group: "pepr.dev", version: "v1", kind: "peprlog", plural: "peprlogs" },
        { isWatch: false, event: Event.CREATE },
      ),
    ],
  ),
];

export const capabilityWithShortKey: CapabilityExport[] = [
  createMockCapability(
    [createMockRbacRule([""], ["nodes"], ["get"])],
    [
      createMockBinding(
        { group: "", version: "v1", kind: "node", plural: "nodes" },
        { isWatch: false, event: Event.CREATE },
      ),
    ],
  ),
];

export const capabilityWithLongKey: CapabilityExport[] = [
  createMockCapability(
    [createMockRbacRule(["apps"], ["deployments"], ["create"])],
    [
      createMockBinding(
        { group: "apps", version: "v1", kind: "deployment", plural: "deployments" },
        { isWatch: false, event: Event.CREATE },
      ),
    ],
  ),
];
