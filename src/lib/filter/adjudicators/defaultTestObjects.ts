import { GroupVersionKind, kind, KubernetesObject } from "kubernetes-fluent-client";
import { Event, Operation } from "../../enums";
import { AdmissionRequest, Binding, Filters } from "../../types";

export const defaultFilters: Filters = {
  annotations: {},
  deletionTimestamp: false,
  labels: {},
  name: "",
  namespaces: [],
  regexName: "^default$",
  regexNamespaces: [] as string[],
};

const defaultGroupVersionKind: GroupVersionKind = {
  kind: "some-kind",
  group: "some-group",
};

export const defaultBinding: Binding = {
  event: Event.ANY,
  filters: defaultFilters,
  kind: defaultGroupVersionKind,
  model: kind.Pod,
  isFinalize: false,
  isMutate: false,
  isQueue: false,
  isValidate: false,
  isWatch: false,
};

export const defaultAdmissionRequest: AdmissionRequest = {
  uid: "some-uid",
  kind: { kind: "a-kind", group: "a-group" },
  resource: { group: "some-group", version: "some-version", resource: "some-resource" },
  operation: Operation.CONNECT,
  name: "some-name",
  userInfo: {},
  object: {},
};

export const defaultKubernetesObject: KubernetesObject = {
  apiVersion: "some-version",
  kind: "some-kind",
  metadata: { name: "some-name" },
};
