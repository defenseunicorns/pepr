import { modelToGroupVersionKind, kind, KubernetesObject } from "kubernetes-fluent-client";
import { Event, Operation } from "../../enums";
import { Binding } from "../../types";

export const defaultFilters = {
  annotations: {},
  deletionTimestamp: false,
  labels: {},
  name: "",
  namespaces: [],
  regexName: "^default$",
  regexNamespaces: [],
};
export const defaultBinding: Binding = {
  event: Event.ANY,
  filters: defaultFilters,
  kind: modelToGroupVersionKind(kind.Pod.name),
  model: kind.Pod,
  isFinalize: false, //Lots of optionals that maybe don't belong here. Would be nice to choose to include
  isMutate: false,
  isQueue: false,
  isValidate: false,
  isWatch: false,
};

export const defaultAdmissionRequest = {
  uid: "some-uid",
  kind: { kind: "a-kind", group: "a-group" },
  group: "a-group",
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
