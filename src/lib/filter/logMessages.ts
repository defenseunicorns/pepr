/* eslint-disable complexity */
import { FilterInput } from "../types";
import {
  carriedName,
  carriedNamespace,
  definedAnnotations,
  definedGroup,
  definedKind,
  definedLabels,
  definedName,
  definedNameRegex,
  definedVersion,
} from "./adjudicators";

const prefix = "Ignoring Admission Callback:";

export const commonLogMessage = (subject: string, filterInput: FilterInput, filterCriteria?: FilterInput): string => {
  switch (subject) {
    case "group":
      return `${prefix} Binding defines ${subject} '${definedGroup(filterInput)}' but Request declares '${carriedName(filterCriteria)}'.`;
    case "deletionTimestamp":
      return getDeletionTimestampLogMessage(filterInput, filterCriteria);
    case "version":
      return `${prefix} Binding defines ${subject} '${definedVersion(filterInput)}' but Request declares '${carriedName(filterCriteria)}'.`;
    case "kind":
      return `${prefix} Binding defines ${subject} '${definedKind(filterInput)}' but Request declares '${carriedName(filterCriteria)}'.`;
    case "ignored namespaces":
      return `${prefix} Object carries namespace '${carriedNamespace(filterInput)}' but ${subject} include '${JSON.stringify(filterCriteria)}'.`;
    case "namespaces":
      return `${prefix} Binding defines ${subject} '${carriedNamespace(filterInput)}' but Object carries '${carriedNamespace(filterCriteria)}'.`;
    case "event":
      return `${prefix} Binding defines ${subject} '${definedKind(filterInput)}' but Request does not declare it.`;
    case "annotations":
      return `${prefix} Binding defines ${subject} '${definedAnnotations(filterInput)}' but Object carries '${carriedName(filterCriteria)}'.`;
    case "labels":
      return `${prefix} Binding defines ${subject} '${definedLabels(filterInput)}' but Object carries '${carriedName(filterCriteria)}'.`;
    case "name":
      return `${prefix} Binding defines ${subject} '${definedName(filterInput)}' but Object carries '${carriedName(filterCriteria)}'.`;
    case "name regex":
      return `${prefix} Binding defines ${subject} '${definedNameRegex(filterInput)}' but Object carries '${carriedName(filterCriteria)}'.`;
    case "namespace regexes":
      return `${prefix} Binding defines ${subject} '${definedNameRegex(filterInput)}' but Object carries '${carriedName(filterCriteria)}'.`;
    default:
      return `An undefined logging condition occurred. Filter input was '${definedName(filterInput)}' and Filter criteria was '${carriedName(filterCriteria)}`;
  }
};

const getDeletionTimestampLogMessage = (filterInput: FilterInput, filterCriteria: FilterInput) => {
  if (filterInput === undefined && filterCriteria === undefined) {
    return `${prefix} Cannot use deletionTimestamp filter on a DELETE operation.`;
  }
  return `${prefix} Binding defines deletionTimestamp but Object does not carry it.`;
};
export const bindingAdmissionRequestLogMessage = (subject: string, binding: FilterInput): string => {
  return `${prefix} Binding defines ${subject} '${definedKind(binding)}' but Request does not declare it.`;
};

export const arrayKubernetesObjectLogMessage = (
  subject: string,
  filterInput?: FilterInput,
  filterCriteria?: FilterInput,
): string => {
  return `${prefix} Object carries ${subject} '${carriedNamespace(filterInput)}' but ${subject}s allowed by Capability are '${JSON.stringify(filterCriteria)}'.`;
};
