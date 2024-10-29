import { FilterInput } from "../types";
import { carriedName, carriedNamespace, definedGroup, definedKind, definedName } from "./adjudicators";

const prefix = "Ignoring Admission Callback:";

export const commonLogMessage = (subject: string, filterInput: FilterInput, filterCriteria?: FilterInput): string => {
  switch (subject) {
    case "group":
      return `${prefix} Binding defines ${subject} '${definedGroup(filterInput)}' but Request declares '${carriedName(filterCriteria)}'.`;
    case "deletionTimestamp":
      return getDeletionTimestampLogMessage(filterInput, filterCriteria);
    case "version":
    case "kind":
      return `${prefix} Binding defines ${subject} '${carriedName(filterInput)}' but Request declares '${carriedName(filterCriteria)}'.`;
    case "ignored namespaces":
      return `${prefix} Object carries namespace '${carriedNamespace(filterInput)}' but ${subject} include '${JSON.stringify(filterCriteria)}'.`;
    case "namespace":
      return `${prefix} Binding defines ${subject} '${carriedNamespace(filterInput)}' but Request declares '${carriedNamespace(filterCriteria)}'.`;
    case "event":
      return `${prefix} Binding defines ${subject} '${definedKind(filterInput)}' but Request does not declare it.`;
    default:
      return `${prefix} Binding defines ${subject} '${definedName(filterInput)}' but Object carries '${carriedName(filterCriteria)}'.`;
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
  filterCriteria?: FilterInput,
  filterInput?: FilterInput,
): string => {
  return `${prefix} Object carries ${subject} '${carriedNamespace(filterInput)}' but ${subject}s allowed by Capability are '${JSON.stringify(filterCriteria)}'.`;
};
