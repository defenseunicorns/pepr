import { KubernetesObject } from "kubernetes-fluent-client";
import {
  carriesIgnoredNamespace,
  misboundDeleteWithDeletionTimestamp,
  mismatchedAnnotations,
  mismatchedDeletionTimestamp,
  mismatchedEvent,
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
import { Operation } from "../mutate-types";
import { FilterInput, FilterParams } from "../types";
import { commonLogMessage } from "./logMessages";

const getAdmissionRequest = (data: FilterParams): KubernetesObject | undefined => {
  return data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object;
};

const createFilter = (
  filterInputSelector: (data: FilterParams) => FilterInput, // FilterInput is unvalidated
  filterCriteriaSelector: (data: FilterParams) => FilterInput, // FilterCriteria adjudicates FilterInput
  filterCheck: (filterInput: FilterInput, filterCriteria?: FilterInput) => boolean, // Adjudicates FilterInput based upon FilterCriteria
  logMessage: (filterInput: FilterInput, filterCriteria?: FilterInput) => string,
) => {
  return (data: FilterParams): string => {
    const filterInput = filterInputSelector(data);
    const filterCriteria = filterCriteriaSelector(data);
    return filterCheck(filterInput, filterCriteria) ? logMessage(filterInput, filterCriteria) : "";
  };
};

export const mismatchedNameFilter = createFilter(
  data => data.binding,
  data => getAdmissionRequest(data),
  (binding, kubernetesObject) => mismatchedName(binding, kubernetesObject),
  (binding, kubernetesObject) => commonLogMessage("name", binding, kubernetesObject),
);

export const mismatchedNameRegexFilter = createFilter(
  data => data.binding,
  data => getAdmissionRequest(data),
  (binding, kubernetesObject) => mismatchedNameRegex(binding, kubernetesObject),
  (binding, kubernetesObject) => commonLogMessage("name regex", binding, kubernetesObject),
);

export const mismatchedNamespaceRegexFilter = createFilter(
  data => data.binding,
  data => getAdmissionRequest(data),
  (binding, kubernetesObject) => mismatchedNamespaceRegex(binding, kubernetesObject),
  (binding, kubernetesObject) => commonLogMessage("namespace regexes", binding, kubernetesObject),
);

export const mismatchedNamespaceFilter = createFilter(
  data => data.binding,
  data => getAdmissionRequest(data),
  (binding, kubernetesObject) => mismatchedNamespace(binding, kubernetesObject),
  (binding, kubernetesObject) => commonLogMessage("namespaces", binding, kubernetesObject),
);

export const mismatchedAnnotationsFilter = createFilter(
  data => data.binding,
  data => getAdmissionRequest(data),
  (binding, kubernetesObject) => mismatchedAnnotations(binding, kubernetesObject),
  (binding, kubernetesObject) => commonLogMessage("annotations", binding, kubernetesObject),
);

export const mismatchedLabelsFilter = createFilter(
  data => data.binding,
  data => getAdmissionRequest(data),
  (binding, kubernetesObject) => mismatchedLabels(binding, kubernetesObject),
  (binding, kubernetesObject) => commonLogMessage("labels", binding, kubernetesObject),
);

export const mismatchedKindFilter = createFilter(
  data => data.binding,
  data => data.request,
  (binding, request) => mismatchedKind(binding, request),
  (binding, request) => commonLogMessage("kind", binding, request),
);

export const mismatchedVersionFilter = createFilter(
  data => data.binding,
  data => data.request,
  (binding, request) => mismatchedVersion(binding, request),
  (binding, request) => commonLogMessage("version", binding, request),
);

export const carriesIgnoredNamespaceFilter = createFilter(
  data => data.ignoredNamespaces,
  data => getAdmissionRequest(data),
  (ignoreArray, kubernetesObject) => carriesIgnoredNamespace(ignoreArray, kubernetesObject),
  (ignoreArray, kubernetesObject) => commonLogMessage("ignored namespaces", kubernetesObject, ignoreArray),
);

export const unbindableNamespacesFilter = createFilter(
  data => data.binding,
  data => getAdmissionRequest(data),
  (binding, request) => uncarryableNamespace(binding, request),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (binding, request) => commonLogMessage("namespaces", binding),
);

export const mismatchedGroupFilter = createFilter(
  data => data.binding,
  data => getAdmissionRequest(data),
  (binding, kubernetesObject) => mismatchedGroup(binding, kubernetesObject),
  (binding, kubernetesObject) => commonLogMessage("group", binding, kubernetesObject),
);

export const mismatchedDeletionTimestampFilter = createFilter(
  data => data.binding,
  data => getAdmissionRequest(data),
  (binding, kubernetesObject) => mismatchedDeletionTimestamp(binding, kubernetesObject),
  (binding, kubernetesObject) => commonLogMessage("deletionTimestamp", binding, kubernetesObject),
);

export const misboundDeleteWithDeletionTimestampFilter = createFilter(
  data => data.binding,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  data => undefined,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (binding, unused) => misboundDeleteWithDeletionTimestamp(binding),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (binding, unused) => commonLogMessage("deletionTimestamp", undefined, undefined),
);
export const mismatchedEventFilter = createFilter(
  data => data.binding,
  data => data.request,
  (binding, request) => mismatchedEvent(binding, request),
  (binding, request) => commonLogMessage("event", binding, request),
);

export const uncarryableNamespaceFilter = createFilter(
  data => data.capabilityNamespaces,
  data => getAdmissionRequest(data),
  (capabilityNamespaces, kubernetesObject) => uncarryableNamespace(capabilityNamespaces, kubernetesObject),
  (capabilityNamespaces, kubernetesObject) =>
    commonLogMessage("namespace array", kubernetesObject, capabilityNamespaces),
);
