import { KubernetesObject } from "kubernetes-fluent-client";
import { AdmissionRequest, FilterInput } from "../types";
import {
  carriedKind,
  carriedName,
  carriedNamespace,
  carriedAPIVersion,
  declaredGroup,
  declaredVersion,
  definedAnnotations,
  declaredKind,
  definedGroup,
  definedKind,
  definedLabels,
  definedName,
  definedNameRegex,
  definedNamespaces,
  definedVersion,
} from "./adjudicators";

const prefix = "Ignoring Admission Callback:";

const ignoredNamespacesKubernetesObjectCases = ["ignored namespaces"];
const capabilityNamespacesKubernetesObjectCases = ["uncarryable namespace"];
const bindingKubernetesObjectCases = [
  "annotations",
  "deletionTimestamp",
  "labels",
  "name regex",
  "name",
  "namespace regexes",
  "namespaces",
];
const bindingAdmissionRequestCases = ["event", "group", "kind", "version"];

export const commonLogMessage = (subject: string, filterInput: FilterInput, filterCriteria?: FilterInput): string => {
  if (bindingKubernetesObjectCases.includes(subject)) {
    return getBindingKubernetesObjectMessage(subject, filterInput, filterCriteria);
  } else if (bindingAdmissionRequestCases.includes(subject)) {
    return getBindingAdmissionRequestMessage(subject, filterInput, filterCriteria);
  } else if (capabilityNamespacesKubernetesObjectCases.includes(subject)){
    return getCapabilityNamespacesKubernetesObjectMessage(subject, filterInput, filterCriteria);
  } else if (ignoredNamespacesKubernetesObjectCases.includes(subject)) { 
    return getIgnoredNamespacesKubernetesObjectMessage(subject, filterInput, filterCriteria);
  } else {
    return getUndefinedLoggingConditionMessage(subject, filterInput, filterCriteria);
  }
};

const getBindingAdmissionRequestMessage = (subject: string, filterInput: FilterInput, filterCriteria?: FilterInput) => {
  const admissionFilterCriteria = filterCriteria as AdmissionRequest;
  switch (subject) {
    case "group":
      return `${prefix} Binding defines ${subject} '${definedGroup(filterInput)}' but Request declares '${declaredGroup(admissionFilterCriteria)}'.`;
    case "event":
      return `${prefix} Binding defines ${subject} '${definedKind(filterInput)}' but Request does not declare it.`;
    case "version":
      return `${prefix} Binding defines ${subject} '${definedVersion(filterInput)}' but Request declares '${declaredVersion(admissionFilterCriteria)}'.`;
    case "kind":
      return `${prefix} Binding defines ${subject} '${definedKind(filterInput)}' but Request declares '${declaredKind(admissionFilterCriteria)}'.`;
    default:
      return getUndefinedLoggingConditionMessage(subject, filterInput, filterCriteria);
  }
};

const getCapabilityNamespacesKubernetesObjectMessage = (subject: string, filterInput: FilterInput, filterCriteria?: FilterInput) => {
  const capabilityNamespacesFilterInput = filterInput as string[];
  const kubernetesObjectFilterCriteria = filterCriteria as KubernetesObject;
  switch(subject){
    case "uncarryable namespace":
      return `${prefix} Object carries namespace '${carriedNamespace(kubernetesObjectFilterCriteria)}' but namespaces allowed by Capability are '${JSON.stringify(capabilityNamespacesFilterInput)}'.`;
    default:
      return getUndefinedLoggingConditionMessage(subject, filterInput, filterCriteria);
  }
}
const getIgnoredNamespacesKubernetesObjectMessage = (subject: string, filterInput: FilterInput, filterCriteria?: FilterInput) => {
  const ingoredNSFilterInput = filterInput as string[];
  const kubernetesObjectFilterCriteria = filterCriteria as KubernetesObject;
  switch(subject){
    case "ignored namespaces":
      return `${prefix} Object carries namespace '${carriedNamespace(kubernetesObjectFilterCriteria)}' but ${subject} include '${JSON.stringify(ingoredNSFilterInput)}'.`;
    default:
      return getUndefinedLoggingConditionMessage(subject, filterInput, filterCriteria);
  }
}

const getBindingKubernetesObjectMessage = (subject: string, filterInput: FilterInput, filterCriteria?: FilterInput) => {
  const kubernetesObjectFilterCriteria = filterCriteria as KubernetesObject;

  switch (subject) {
    case "namespaces":
      return `${prefix} Binding defines ${subject} '${definedNamespaces(filterInput)}' but Object carries '${carriedNamespace(kubernetesObjectFilterCriteria)}'.`;
    case "annotations":
      return `${prefix} Binding defines ${subject} '${definedAnnotations(filterInput)}' but Object carries '${carriedName(kubernetesObjectFilterCriteria)}'.`;
    case "labels":
      return `${prefix} Binding defines ${subject} '${definedLabels(filterInput)}' but Object carries '${carriedName(kubernetesObjectFilterCriteria)}'.`;
    case "name":
      return `${prefix} Binding defines ${subject} '${definedName(filterInput)}' but Object carries '${carriedName(kubernetesObjectFilterCriteria)}'.`;
    case "namespace array":
      return `${prefix} Object carries namespace '${carriedNamespace(kubernetesObjectFilterCriteria)}' but namespaces allowed by Capability are '${JSON.stringify(definedNamespaces(filterInput))}'.`;
    case "name regex":
      return `${prefix} Binding defines ${subject} '${definedNameRegex(filterInput)}' but Object carries '${carriedName(kubernetesObjectFilterCriteria)}'.`;
    case "namespace regexes":
      return `${prefix} Binding defines ${subject} '${definedNameRegex(filterInput)}' but Object carries '${carriedName(kubernetesObjectFilterCriteria)}'.`;
    case "deletionTimestamp":
      return getDeletionTimestampLogMessage(filterInput, filterCriteria);
    default:
      return getUndefinedLoggingConditionMessage(subject, filterInput, filterCriteria);
  }
};

const getUndefinedLoggingConditionMessage = (
  subject: string,
  filterInput: FilterInput,
  filterCriteria: FilterInput,
) => {
  return `${prefix} An undefined logging condition occurred. Filter input was '${JSON.stringify(filterInput)}' and Filter criteria was '${JSON.stringify(filterCriteria)}'`;
};

const getDeletionTimestampLogMessage = (filterInput: FilterInput, filterCriteria: FilterInput) => {
  if (filterInput === undefined && filterCriteria === undefined) {
    return `${prefix} Cannot use deletionTimestamp filter on a DELETE operation.`;
  }
  return `${prefix} Binding defines deletionTimestamp but Object does not carry it.`;
};
