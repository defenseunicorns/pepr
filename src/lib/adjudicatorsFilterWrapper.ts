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

//TODO: Dupe'd declaration
type FilterParams = {
  binding: Binding;
  request: AdmissionRequest;
  capabilityNamespaces: string[];
  ignoredNamespaces?: string[];
};
const prefix = "Ignoring Admission Callback:";

export const mismatchedNameFilter = (data: FilterParams): string => {
  const obj = data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object;
  const result = mismatchedName(data.binding, obj)
    ? `${prefix} Binding defines name '${definedName(data.binding)}' but Object carries '${carriedName(obj)}'.`
    : "";
  return result;
};

export const mismatchedNameRegexFilter = (data: FilterParams): string => {
  const obj = data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object;
  const result = mismatchedNameRegex(data.binding, obj)
    ? `${prefix} Binding defines name regex '${definedNameRegex(data.binding)}' but Object carries '${carriedName(data.request.operation)}'.`
    : "";
  return result;
};

export const mismatchedNamespaceRegexFilter = (data: FilterParams): string => {
  const obj = data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object;
  const result = mismatchedNamespaceRegex(data.binding, obj)
    ? `${prefix} Binding defines namespace regexes '${JSON.stringify(definedNamespaceRegexes(data.binding))}' but Object carries '${carriedNamespace(obj)}'.`
    : "";

  return result;
};

export const mismatchedNamespaceFilter = (data: FilterParams): string => {
  const obj = data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object;
  const result = mismatchedNamespace(data.binding, obj)
    ? `${prefix} Binding defines namespaces '${JSON.stringify(definedNamespaces(data.binding))}' but Object carries '${carriedNamespace(obj)}'.`
    : "";

  return result;
};

export const uncarryableNamespaceFilter = (data: FilterParams): string => {
  const obj = data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object;
  const result = uncarryableNamespace(data.capabilityNamespaces, obj)
    ? `${prefix} Object carries namespace '${carriedNamespace(obj)}' but namespaces allowed by Capability are '${JSON.stringify(data.capabilityNamespaces)}'.`
    : "";

  return result;
};

export const mismatchedDeletionTimestampFilter = (data: FilterParams): string => {
  const obj = data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object;
  const result = mismatchedDeletionTimestamp(data.binding, obj)
    ? `${prefix} Binding defines deletionTimestamp but Object does not carry it.`
    : "";

  return result;
};

export const mismatchedAnnotationsFilter = (data: FilterParams): string => {
  const obj = data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object;
  const result = mismatchedAnnotations(data.binding, obj)
    ? `${prefix} Binding defines annotations '${JSON.stringify(definedAnnotations(data.binding))}' but Object carries '${JSON.stringify(carriedAnnotations(obj))}'.`
    : "";

  return result;
};

export const mismatchedLabelsFilter = (data: FilterParams): string => {
  const obj = data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object;
  const result = mismatchedLabels(data.binding, obj)
    ? `${prefix} Binding defines labels '${JSON.stringify(definedAnnotations(data.binding))}' but Object carries '${JSON.stringify(carriedAnnotations(obj))}'.`
    : "";

  return result;
};

export const mismatchedKindFilter = (data: FilterParams): string => {
  const result = mismatchedKind(data.binding, data.request)
    ? `${prefix} Binding defines kind '${definedKind(data.binding)}' but Request declares '${declaredKind(data.request)}'.`
    : "";

  return result;
};

export const mismatchedGroupFilter = (data: FilterParams): string => {
  const result = mismatchedGroup(data.binding, data.request)
    ? `${prefix} Binding defines group '${definedKind(data.binding)}' but Request declares '${declaredKind(data.request)}'.`
    : "";

  return result;
};

export const mismatchedVersionFilter = (data: FilterParams): string => {
  const result = mismatchedVersion(data.binding, data.request)
    ? `${prefix} Binding defines version '${definedKind(data.binding)}' but Request declares '${declaredKind(data.request)}'.`
    : "";

  return result;
};

export const carriesIgnoredNamespacesFilter = (data: FilterParams): string => {
  const obj = data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object;
  const result = carriesIgnoredNamespace(data.ignoredNamespaces, obj)
    ? `${prefix} Object carries namespace '${carriedNamespace(obj)}' but ignored namespaces include '${JSON.stringify(data.ignoredNamespaces)}'.`
    : "";

  return result;
};
