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

const bindingAdmissionRequestLogMessage = (subject: string, binding: Binding, request?: AdmissionRequest) =>
  `${prefix} Binding defines ${subject} '${definedName(binding)}' but Request declares '${carriedName(request)}'.`;

const ignoreArrayKubernetesObjectLogMessage = (
  subject: string,
  array?: string[],
  kubernetesObject?: KubernetesObject,
) =>
  `${prefix} Object carries ${subject} '${carriedNamespace(kubernetesObject)}' but ignored ${subject}s include '${JSON.stringify(array)}'.`;

const arrayKubernetesObjectLogMessage = (subject: string, array?: string[], kubernetesObject?: KubernetesObject) =>
  `${prefix} Object carries ${subject} '${carriedNamespace(kubernetesObject)}' but ${subject}s allowed by Capability are '${JSON.stringify(array)}'.`;

const getAdmissionRequest = (data: FilterParams): KubernetesObject | undefined => {
  return data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object;
};

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
  data => getAdmissionRequest(data),
  (binding, kubernetesObject) => mismatchedName(binding, kubernetesObject),
  (binding, kubernetesObject) => bindingKubernetesObjectLogMessage("name", binding, kubernetesObject),
);

export const mismatchedNameRegexFilter = createFilter(
  data => data.binding,
  data => getAdmissionRequest(data),
  (binding, kubernetesObject) => mismatchedNameRegex(binding, kubernetesObject),
  (binding, kubernetesObject) => bindingKubernetesObjectLogMessage("name regex", binding, kubernetesObject),
);

export const mismatchedNamespaceRegexFilter = createFilter(
  data => data.binding,
  data => getAdmissionRequest(data),
  (binding, kubernetesObject) => mismatchedNamespaceRegex(binding, kubernetesObject),
  (binding, kubernetesObject) => bindingKubernetesObjectLogMessage("namespace regexes", binding, kubernetesObject),
);

export const mismatchedNamespaceFilter = createFilter(
  data => data.binding,
  data => getAdmissionRequest(data),
  (binding, kubernetesObject) => mismatchedNamespace(binding, kubernetesObject),
  (binding, kubernetesObject) => bindingKubernetesObjectLogMessage("namespaces", binding, kubernetesObject),
);

export const mismatchedAnnotationsFilter = createFilter(
  data => data.binding,
  data => getAdmissionRequest(data),
  (binding, kubernetesObject) => mismatchedAnnotations(binding, kubernetesObject),
  (binding, kubernetesObject) => bindingKubernetesObjectLogMessage("annotations", binding, kubernetesObject),
);

export const mismatchedLabelsFilter = createFilter(
  data => data.binding,
  data => getAdmissionRequest(data),
  (binding, kubernetesObject) => mismatchedLabels(binding, kubernetesObject),
  (binding, kubernetesObject) => bindingKubernetesObjectLogMessage("labels", binding, kubernetesObject),
);

export const mismatchedKindFilter = createFilter(
  data => data.binding,
  data => data.request,
  (binding, request) => mismatchedKind(binding, request),
  (binding, request) => bindingAdmissionRequestLogMessage("kind", binding, request),
);

export const mismatchedVersionFilter = createFilter(
  data => data.binding,
  data => data.request,
  (binding, request) => mismatchedVersion(binding, request),
  (binding, request) => bindingAdmissionRequestLogMessage("version", binding, request),
);

export const carriesIgnoredNamespacesFilter = createFilter(
  data => data.ignoredNamespaces,
  data => getAdmissionRequest(data),
  (ignoreArray, kubernetesObject) => carriesIgnoredNamespace(ignoreArray, kubernetesObject),
  (ignoreArray, kubernetesObject) => ignoreArrayKubernetesObjectLogMessage("namespace", ignoreArray, kubernetesObject),
);

export const uncarryableNamespaceFilter = createFilter(
  data => data.capabilityNamespaces,
  data => getAdmissionRequest(data),
  (capabilityNamespaces, kubernetesObject) => uncarryableNamespace(capabilityNamespaces, kubernetesObject),
  (capabilityNamespaces, kubernetesObject) =>
    arrayKubernetesObjectLogMessage("namespace", capabilityNamespaces, kubernetesObject),
);

export const unbindableNamespacesFilter = createFilter(
  data => data.binding,
  data => getAdmissionRequest(data),
  (binding, request) => uncarryableNamespace(binding, request),
  (binding, request) =>
    `${prefix} Binding carries namespace '${carriedNamespace(request)}' but namespaces allowed by Capability are '${JSON.stringify(binding)}'.`,
);

export const mismatchedGroupFilter = createFilter(
  data => data.binding,
  data => getAdmissionRequest(data),
  (binding, kubernetesObject) => mismatchedGroup(binding, kubernetesObject),
  (binding, kubernetesObject) =>
    `${prefix} Binding defines group '${definedKind(binding)}' but Request declares '${declaredKind(kubernetesObject)}'.`,
);

export const mismatchedDeletionTimestampFilter = createFilter(
  data => data.binding,
  data => getAdmissionRequest(data),
  (binding, kubernetesObject) => mismatchedDeletionTimestamp(binding, kubernetesObject),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (binding, kubernetesObject) => `${prefix} Binding defines deletionTimestamp but Object does not carry it.`,
);
