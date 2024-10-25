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

const createFilter = <T1, T2>(
  dataSelector: (data: FilterParams) => T1,
  objectSelector: (data: FilterParams) => T2,
  mismatchCheck: (data: T1, obj?: T2) => boolean,
  logMessage: (data: T1, obj?: T2) => string,
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
  (binding, obj) => mismatchedName(binding, obj),
  (binding, obj) =>
    `${prefix} Binding defines name '${definedName(binding)}' but Object carries '${carriedName(obj)}'.`,
);

export const mismatchedNameRegexFilter = createFilter(
  data => data.binding,
  data => (data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object),
  (binding, obj) => mismatchedNameRegex(binding, obj),
  (binding, obj) =>
    `${prefix} Binding defines name regex '${definedNameRegex(binding)}' but Object carries '${carriedName(obj)}'.`,
);

export const mismatchedNamespaceRegexFilter = createFilter(
  data => data.binding,
  data => (data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object),
  (binding, obj) => mismatchedNamespaceRegex(binding, obj),
  (binding, obj) =>
    `${prefix} Binding defines namespace regexes '${JSON.stringify(definedNamespaceRegexes(binding))}' but Object carries '${carriedNamespace(obj)}'.`,
);

export const mismatchedNamespaceFilter = createFilter(
  data => data.binding,
  data => (data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object),
  (binding, obj) => mismatchedNamespace(binding, obj),
  (binding, obj) =>
    `${prefix} Binding defines namespaces '${JSON.stringify(definedNamespaces(binding))}' but Object carries '${carriedNamespace(obj)}'.`,
);

export const mismatchedAnnotationsFilter = createFilter(
  data => data.binding,
  data => (data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object),
  (binding, obj) => mismatchedAnnotations(binding, obj),
  (binding, obj) =>
    `${prefix} Binding defines annotations '${JSON.stringify(definedAnnotations(binding))}' but Object carries '${JSON.stringify(carriedAnnotations(obj))}'.`,
);

export const mismatchedLabelsFilter = createFilter(
  data => data.binding,
  data => (data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object),
  (binding, obj) => mismatchedLabels(binding, obj),
  (binding, obj) =>
    `${prefix} Binding defines labels '${JSON.stringify(definedAnnotations(binding))}' but Object carries '${JSON.stringify(carriedAnnotations(obj))}'.`,
);

export const mismatchedDeletionTimestampFilter = createFilter(
  data => data.binding,
  data => (data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object),
  (binding, obj) => mismatchedDeletionTimestamp(binding, obj),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (binding, obj) => `${prefix} Binding defines deletionTimestamp but Object does not carry it.`,
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
  (binding, obj) => mismatchedGroup(binding, obj),
  (binding, obj) =>
    `${prefix} Binding defines group '${definedKind(binding)}' but Request declares '${declaredKind(obj)}'.`,
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
  (ignoreArray, obj) => carriesIgnoredNamespace(ignoreArray, obj),
  (ignoreArray, obj) =>
    `${prefix} Object carries namespace '${carriedNamespace(obj)}' but ignored namespaces include '${JSON.stringify(ignoreArray)}'.`,
);

export const uncarryableNamespaceFilter = createFilter(
  data => data.capabilityNamespaces,
  data => (data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object),
  (capabilityNamespaces, obj) => uncarryableNamespace(capabilityNamespaces, obj),
  (capabilityNamespaces, obj) =>
    `${prefix} Object carries namespace '${carriedNamespace(obj)}' but namespaces allowed by Capability are '${JSON.stringify(capabilityNamespaces)}'.`,
);

export const unbindableNamespacesFilter = createFilter(
  data => data.binding,
  data => (data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object),
  (capabilityNamespaces, binding) => uncarryableNamespace(capabilityNamespaces, binding),
  (capabilityNamespaces, binding) =>
    `${prefix} Binding carries namespace '${carriedNamespace(binding)}' but namespaces allowed by Capability are '${JSON.stringify(capabilityNamespaces)}'.`,
);
