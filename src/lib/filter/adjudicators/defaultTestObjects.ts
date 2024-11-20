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
  //   kind: { kind: "some-kind", group: "some-group" }, // Should it be this instead?? Used elsewhere.
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

const callback = () => undefined;
// const podKind = modelToGroupVersionKind(kind.Pod.name);
const deploymentKind = modelToGroupVersionKind(kind.Deployment.name);
const clusterRoleKind = modelToGroupVersionKind(kind.ClusterRole.name);

export const groupBinding = {
  callback,
  event: Event.CREATE,
  filters: defaultFilters,
  kind: deploymentKind,
  model: kind.Deployment,
};

export const clusterScopedBinding = {
  callback,
  event: Event.DELETE,
  filters: defaultFilters,
  kind: clusterRoleKind,
  model: kind.ClusterRole,
};
