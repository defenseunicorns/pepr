import { FilterInput } from "../types";
import {
  carriedKind,
  carriedName,
  carriedNamespace,
  carriedVersion,
  definedAnnotations,
  definedGroup,
  definedKind,
  definedLabels,
  definedName,
  definedNameRegex,
  definedNamespaces,
  definedVersion,
} from "./adjudicators";

const prefix = "Ignoring Admission Callback:";

const bindingKubernetesObjectCases = [
  "annotations",
  "deletionTimestamp",
  "labels",
  "name regex",
  "name",
  "namespace array",
  "namespace regexes",
  "namespaces",
];
const bindingAdmissionRequestCases = ["event", "group", "kind", "version"];

export const commonLogMessage = (subject: string, filterInput: FilterInput, filterCriteria?: FilterInput): string => {
  if (bindingKubernetesObjectCases.includes(subject)) {
    return getBindingKubernetesObjectMessage(subject, filterInput, filterCriteria);
  } else if (bindingAdmissionRequestCases.includes(subject)) {
    return getBindingAdmissionRequestMessage(subject, filterInput, filterCriteria);
  } else if (subject === "ignored namespaces") {
    return `${prefix} Object carries namespace '${carriedNamespace(filterInput)}' but ${subject} include '${JSON.stringify(filterCriteria)}'.`;
  } else {
    return getUndefinedLoggingConditionMessage(subject, filterInput, filterCriteria);
  }
};

const getBindingAdmissionRequestMessage = (subject: string, filterInput: FilterInput, filterCriteria?: FilterInput) => {
  switch (subject) {
    case "group":
      return `${prefix} Binding defines ${subject} '${definedGroup(filterInput)}' but Request declares '${carriedName(filterCriteria)}'.`;
    case "event":
      return `${prefix} Binding defines ${subject} '${definedKind(filterInput)}' but Request does not declare it.`;
    case "version":
      return `${prefix} Binding defines ${subject} '${definedVersion(filterInput)}' but Request declares '${carriedVersion(filterCriteria)}'.`;
    case "kind":
      return `${prefix} Binding defines ${subject} '${definedKind(filterInput)}' but Request declares '${carriedKind(filterCriteria)}'.`;
    default:
      return getUndefinedLoggingConditionMessage(subject, filterInput, filterCriteria);
  }
};

const getBindingKubernetesObjectMessage = (subject: string, filterInput: FilterInput, filterCriteria?: FilterInput) => {
  switch (subject) {
    case "namespaces":
      return `${prefix} Binding defines ${subject} '${definedNamespaces(filterInput)}' but Object carries '${carriedNamespace(filterCriteria)}'.`;
    case "annotations":
      return `${prefix} Binding defines ${subject} '${definedAnnotations(filterInput)}' but Object carries '${carriedName(filterCriteria)}'.`;
    case "labels":
      return `${prefix} Binding defines ${subject} '${definedLabels(filterInput)}' but Object carries '${carriedName(filterCriteria)}'.`;
    case "name":
      return `${prefix} Binding defines ${subject} '${definedName(filterInput)}' but Object carries '${carriedName(filterCriteria)}'.`;
    case "namespace array":
      return `${prefix} Object carries namespace '${carriedNamespace(filterInput)}' but namespaces allowed by Capability are '${JSON.stringify(filterCriteria)}'.`;
    case "name regex":
      return `${prefix} Binding defines ${subject} '${definedNameRegex(filterInput)}' but Object carries '${carriedName(filterCriteria)}'.`;
    case "namespace regexes":
      return `${prefix} Binding defines ${subject} '${definedNameRegex(filterInput)}' but Object carries '${carriedName(filterCriteria)}'.`;
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
