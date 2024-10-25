import { KubernetesObject } from "kubernetes-fluent-client";
import {
  carriedName,
  carriedNamespace,
  carriesIgnoredNamespace,
  declaredKind,
  definedKind,
  definedName,
  mismatchedAnnotations,
  mismatchedDeletionTimestamp,
  mismatchedGroup,
  mismatchedKind,
  mismatchedLabels,
  mismatchedName,
  mismatchedNameRegex,
  mismatchedNamespace,
  mismatchedNamespaceRegex,
  mismatchedVersion,
  uncarryableNamespace,
} from "./adjudicators";
import { AdmissionRequest, Binding, Operation } from "./types";

type FilterParams = {
  binding: Binding;
  request: AdmissionRequest;
  capabilityNamespaces: string[];
  ignoredNamespaces?: string[];
};

const prefix = "Ignoring Admission Callback:";
const bindingKubernetesObjectLogMessage = (subject: string, binding: Binding, kubernetesObject?: KubernetesObject) =>
  `${prefix} Binding defines ${subject} '${definedName(binding)}' but Object carries '${carriedName(kubernetesObject)}'.`;

const createFilter = <T1, T2>(
  dataSelector: (data: FilterParams) => T1,
  objectSelector: (data: FilterParams) => T2,
  mismatchCheck: (data: T1, kubernetesObject?: T2) => boolean,
  logMessage: (data: T1, kubernetesObject?: T2) => string,
) => {
  return (data: FilterParams): string => {
    const dataValue = dataSelector(data);
    const objectValue = objectSelector(data);
    return mismatchCheck(dataValue, objectValue) ? logMessage(dataValue, objectValue) : "";
  };
};

export const mismatchedNameFilter = createFilter(
  data => data.binding,
  data => (data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object),
  (binding, kubernetesObject) => mismatchedName(binding, kubernetesObject),
  (binding, kubernetesObject) => bindingKubernetesObjectLogMessage("name", binding, kubernetesObject),
);

export const mismatchedNameRegexFilter = createFilter(
  data => data.binding,
  data => (data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object),
  (binding, kubernetesObject) => mismatchedNameRegex(binding, kubernetesObject),
  (binding, kubernetesObject) => bindingKubernetesObjectLogMessage("name regex", binding, kubernetesObject),
);

export const mismatchedNamespaceRegexFilter = createFilter(
  data => data.binding,
  data => (data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object),
  (binding, kubernetesObject) => mismatchedNamespaceRegex(binding, kubernetesObject),
  (binding, kubernetesObject) => bindingKubernetesObjectLogMessage("namespace regexes", binding, kubernetesObject),
);

export const mismatchedNamespaceFilter = createFilter(
  data => data.binding,
  data => (data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object),
  (binding, kubernetesObject) => mismatchedNamespace(binding, kubernetesObject),
  (binding, kubernetesObject) => bindingKubernetesObjectLogMessage("namespaces", binding, kubernetesObject),
);

export const mismatchedAnnotationsFilter = createFilter(
  data => data.binding,
  data => (data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object),
  (binding, kubernetesObject) => mismatchedAnnotations(binding, kubernetesObject),
  (binding, kubernetesObject) => bindingKubernetesObjectLogMessage("annotations", binding, kubernetesObject),
);

export const mismatchedLabelsFilter = createFilter(
  data => data.binding,
  data => (data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object),
  (binding, kubernetesObject) => mismatchedLabels(binding, kubernetesObject),
  (binding, kubernetesObject) => bindingKubernetesObjectLogMessage("labels", binding, kubernetesObject),
);

export const mismatchedDeletionTimestampFilter = createFilter(
  data => data.binding,
  data => (data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object),
  (binding, kubernetesObject) => mismatchedDeletionTimestamp(binding, kubernetesObject),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (binding, kubernetesObject) => `${prefix} Binding defines deletionTimestamp but Object does not carry it.`,
);

export const mismatchedKindFilter = createFilter(
  data => data.binding,
  data => data.request,
  (binding, request) => mismatchedKind(binding, request),
  (binding, request) =>
    `${prefix} Binding defines kind '${definedKind(binding)}' but Request declares '${declaredKind(request)}'.`,
);

export const mismatchedGroupFilter = createFilter(
  data => data.binding,
  data => (data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object),
  (binding, kubernetesObject) => mismatchedGroup(binding, kubernetesObject),
  // (binding, kubernetesObject) => bindingKubernetesObjectLogMessage("group", binding, kubernetesObject)
  (binding, kubernetesObject) =>
    `${prefix} Binding defines group '${definedKind(binding)}' but Request declares '${declaredKind(kubernetesObject)}'.`,
);

export const mismatchedVersionFilter = createFilter(
  data => data.binding,
  data => data.request,
  (binding, request) => mismatchedVersion(binding, request),
  (binding, request) =>
    `${prefix} Binding defines version '${definedKind(binding)}' but Request declares '${declaredKind(request)}'.`,
);

export const carriesIgnoredNamespacesFilter = createFilter(
  data => data.ignoredNamespaces,
  data => (data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object),
  (ignoreArray, kubernetesObject) => carriesIgnoredNamespace(ignoreArray, kubernetesObject),
  (ignoreArray, kubernetesObject) =>
    `${prefix} Object carries namespace '${carriedNamespace(kubernetesObject)}' but ignored namespaces include '${JSON.stringify(ignoreArray)}'.`,
);

export const uncarryableNamespaceFilter = createFilter(
  data => data.capabilityNamespaces,
  data => (data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object),
  (capabilityNamespaces, kubernetesObject) => uncarryableNamespace(capabilityNamespaces, kubernetesObject),
  (capabilityNamespaces, kubernetesObject) =>
    `${prefix} Object carries namespace '${carriedNamespace(kubernetesObject)}' but namespaces allowed by Capability are '${JSON.stringify(capabilityNamespaces)}'.`,
);

export const unbindableNamespacesFilter = createFilter(
  data => data.binding,
  data => (data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object),
  (capabilityNamespaces, binding) => uncarryableNamespace(capabilityNamespaces, binding),
  (capabilityNamespaces, binding) =>
    `${prefix} Binding carries namespace '${carriedNamespace(binding)}' but namespaces allowed by Capability are '${JSON.stringify(capabilityNamespaces)}'.`,
);
