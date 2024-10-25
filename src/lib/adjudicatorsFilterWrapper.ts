import { KubernetesObject } from "kubernetes-fluent-client";
import {
  carriedAnnotations,
  carriedName,
  carriedNamespace,
  carriesIgnoredNamespace,
  declaredKind,
  definedAnnotations,
  definedKind,
  definedName,
  definedNameRegex,
  definedNamespaceRegexes,
  definedNamespaces,
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

const createBindingObjectFilter = (
  mismatchCheck: (data: Binding, obj?: KubernetesObject) => boolean,
  logMessage: (data: Binding, obj?: KubernetesObject) => string,
) => {
  return (data: FilterParams): string => {
    const obj = data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object;
    return mismatchCheck(data.binding, obj) ? logMessage(data.binding, obj) : "";
  };
};

const createBindingRequestFilter = (
  mismatchCheck: (data: Binding, obj: AdmissionRequest) => boolean,
  logMessage: (data: Binding, obj: AdmissionRequest) => string,
) => {
  return (data: FilterParams): string => {
    return mismatchCheck(data.binding, data.request) ? logMessage(data.binding, data.request) : "";
  };
};

const createArrayObjectFilter = (
  mismatchCheck: (data: string[], obj?: KubernetesObject) => boolean,
  logMessage: (data: string[], obj?: KubernetesObject) => string,
) => {
  return (data: FilterParams): string => {
    const obj = data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object;
    return mismatchCheck(data.capabilityNamespaces, obj) ? logMessage(data.capabilityNamespaces, obj) : "";
  };
};

export const mismatchedNameFilter = createBindingObjectFilter(
  mismatchedName,
  (data, obj) => `${prefix} Binding defines name '${definedName(data)}' but Object carries '${carriedName(obj)}'.`,
);

export const mismatchedNameRegexFilter = createBindingObjectFilter(
  mismatchedNameRegex,
  (data, obj) =>
    `${prefix} Binding defines name regex '${definedNameRegex(data)}' but Object carries '${carriedName(obj)}'.`,
);

export const mismatchedNamespaceRegexFilter = createBindingObjectFilter(
  mismatchedNamespaceRegex,
  (data, obj) =>
    `${prefix} Binding defines namespace regexes '${JSON.stringify(definedNamespaceRegexes(data))}' but Object carries '${carriedNamespace(obj)}'.`,
);

export const mismatchedNamespaceFilter = createBindingObjectFilter(
  mismatchedNamespace,
  (data, obj) =>
    `${prefix} Binding defines namespace regexes '${JSON.stringify(definedNamespaces(data))}' but Object carries '${carriedNamespace(obj)}'.`,
);

export const mismatchedAnnotationsFilter = createBindingObjectFilter(
  mismatchedAnnotations,
  (data, obj) =>
    `${prefix} Binding defines annotations '${JSON.stringify(definedAnnotations(data))}' but Object carries '${JSON.stringify(carriedAnnotations(obj))}'.`,
);

export const mismatchedLabelsFilter = createBindingObjectFilter(
  mismatchedLabels,
  (data, obj) =>
    `${prefix} Binding defines labels '${JSON.stringify(definedAnnotations(data))}' but Object carries '${JSON.stringify(carriedAnnotations(obj))}'.`,
);

export const mismatchedDeletionTimestampFilter = createBindingObjectFilter(
  mismatchedDeletionTimestamp,
  (data, obj) =>
    `${prefix} Binding defines labels '${JSON.stringify(definedAnnotations(data))}' but Object carries '${JSON.stringify(carriedAnnotations(obj))}'.`,
);
export const mismatchedKindFilter = createBindingRequestFilter(
  mismatchedKind,
  (data, request) =>
    `${prefix} Binding defines kind '${definedKind(data)}' but Request declares '${declaredKind(request)}'.`,
);

export const mismatchedGroupFilter = createBindingObjectFilter(
  mismatchedGroup,
  (data, request) =>
    `${prefix} Binding defines group '${definedKind(data)}' but Request declares '${declaredKind(request)}'.`,
);

export const mismatchedVersionFilter = createBindingRequestFilter(
  mismatchedVersion,
  (data, request) =>
    `${prefix} Binding defines version '${definedKind(data)}' but Request declares '${declaredKind(request)}'.`,
);

export const carriesIgnoredNamespacesFilter = createArrayObjectFilter(
  carriesIgnoredNamespace,
  (data, obj) =>
    `${prefix} Object carries namespace '${carriedNamespace(obj)}' but ignored namespaces include '${JSON.stringify(data)}'.`,
);

export const uncarryableNamespaceFilter = createArrayObjectFilter(
  uncarryableNamespace,
  (data, obj) =>
    `${prefix} Object carries namespace '${carriedNamespace(obj)}' but ignored namespaces include '${JSON.stringify(data)}'.`,
);
