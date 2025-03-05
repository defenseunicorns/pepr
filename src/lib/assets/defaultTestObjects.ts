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

export const newCapabilityWithFinalize: CapabilityExport[] = [
  createMockCapability(
    [createMockRbacRule(["pepr.dev"], ["peprstores"], ["patch"])],
    [createMockBinding("pepr.dev", "v1", "peprstore", "peprstores", false, Event.CREATE, true)],
  ),
];

export const newCapabilityWithDuplicates: CapabilityExport[] = [
  createMockCapability(
    [createMockRbacRule(["pepr.dev"], ["peprstores"], ["create", "get"])],
    [createMockBinding("pepr.dev", "v1", "peprlog", "peprlogs", false, Event.CREATE)],
  ),
  createMockCapability(
    [createMockRbacRule(["pepr.dev"], ["peprstores"], ["get", "patch"])],
    [createMockBinding("pepr.dev", "v1", "peprlog", "peprlogs", false, Event.CREATE)],
  ),
];

export const newCapabilityWithShortKey: CapabilityExport[] = [
  createMockCapability(
    [createMockRbacRule([""], ["nodes"], ["get"])],
    [createMockBinding("", "v1", "node", "nodes", false, Event.CREATE)],
  ),
];

export const newCapabilityWithLongKey: CapabilityExport[] = [
  createMockCapability(
    [createMockRbacRule(["apps"], ["deployments"], ["create"])],
    [createMockBinding("apps", "v1", "deployment", "deployments", false, Event.CREATE)],
  ),
];
