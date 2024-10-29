import { FilterInput } from "../types";
import { carriedName, carriedNamespace, definedGroup, definedKind, definedName } from "./adjudicators";

const prefix = "Ignoring Admission Callback:";

export const commonLogMessage = (subject: string, filterInput: FilterInput, filterCriteria?: FilterInput): string => {
  switch (subject) {
    case "group":
      return `${prefix} Binding defines ${subject} '${definedGroup(filterInput)}' but Request declares '${carriedName(filterCriteria)}'.`;
    case "deletionTimestamp":
      return `${prefix} Binding defines ${subject} but Object does not carry it.`;
    case "version":
    case "kind":
      return `${prefix} Binding defines ${subject} '${carriedName(filterInput)}' but Request declares '${carriedName(filterCriteria)}'.`;
    case "ignored namespaces":
      return `${prefix} Object carries namespace '${carriedNamespace(filterInput)}' but ${subject} include '${JSON.stringify(filterCriteria)}'.`;
    case "namespace":
      return `${prefix} Binding defines ${subject} '${carriedNamespace(filterInput)}' but Request declares '${carriedNamespace(filterCriteria)}'.`;
    default:
      return `${prefix} Binding defines ${subject} '${definedName(filterInput)}' but Object carries '${carriedName(filterCriteria)}'.`;
  }
};

export const bindingAdmissionRequestLogMessage = (
  subject: string,
  binding: FilterInput,
  request?: FilterInput,
): string => {
  switch (subject) {
    case "name":
    case "kind":
      return `${prefix} Binding defines ${subject} '${carriedName(binding)}' but Request declares '${carriedName(request)}'.`;
    default:
      return `${prefix} Binding defines ${subject} '${definedKind(binding)}' but Request does not declare it.`;
  }
};

export const arrayKubernetesObjectLogMessage = (
  subject: string,
  filterCriteria?: FilterInput,
  filterInput?: FilterInput,
): string => {
  let logMessage: string = "";
  switch (subject) {
    case "namespace":
      logMessage = `${prefix} Object carries ${subject} '${carriedNamespace(filterInput)}' but ${subject}s allowed by Capability are '${JSON.stringify(filterCriteria)}'.`;
      break;
    case "ignored namespaces":
      logMessage = `${prefix} Object carries namespace '${carriedNamespace(filterInput)}' but ${subject} include '${JSON.stringify(filterCriteria)}'.`;
      break;
    default:
      break;
  }
  return logMessage;
};

export const bindingLogMessage = (subject: string) => `${prefix} Cannot use ${subject} filter on a DELETE operation.`;
