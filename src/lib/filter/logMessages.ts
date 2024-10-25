import { FilterInput } from "../types";
import { carriedName, carriedNamespace, definedName } from "./adjudicators";

const prefix = "Ignoring Admission Callback:";

export const bindingKubernetesObjectLogMessage = (
  subject: string,
  filterInput: FilterInput,
  filterCriteria?: FilterInput,
): string => {
  let logMessage = "";
  if (subject === "group") {
    logMessage = `${prefix} Binding defines ${subject} '${definedName(filterInput)}' but Request declares '${carriedName(filterCriteria)}'.`;
  } else if (subject === "deletionTimestamp") {
    logMessage = `${prefix} Binding defines ${subject} but Object does not carry it.`;
  } else {
    logMessage = `${prefix} Binding defines ${subject} '${definedName(filterInput)}' but Object carries '${carriedName(filterCriteria)}'.`;
  }
  return logMessage;
};

export const bindingAdmissionRequestLogMessage = (subject: string, binding: FilterInput, request?: FilterInput) => {
  let logMessage = "";

  if (subject === "namespace") {
    logMessage = `${prefix} Binding carries ${subject} '${definedName(binding)}' but namespaces allowed by Capability are '${carriedName(request)}'.`;
  } else {
    logMessage = `${prefix} Binding defines ${subject} '${definedName(binding)}' but Request declares '${carriedName(request)}'.`;
  }
  return logMessage;
};

export const ignoreArrayKubernetesObjectLogMessage = (
  subject: string,
  filterCriteria?: FilterInput,
  filterInput?: FilterInput,
) =>
  `${prefix} Object carries ${subject} '${carriedNamespace(filterInput)}' but ignored ${subject}s include '${JSON.stringify(filterCriteria)}'.`;

export const arrayKubernetesObjectLogMessage = (
  subject: string,
  filterCriteria?: FilterInput,
  filterInput?: FilterInput,
) =>
  `${prefix} Object carries ${subject} '${carriedNamespace(filterInput)}' but ${subject}s allowed by Capability are '${JSON.stringify(filterCriteria)}'.`;
