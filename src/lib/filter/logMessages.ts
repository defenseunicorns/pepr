import { KubernetesObject } from "kubernetes-fluent-client";
import { AdmissionRequest, Binding } from "../types";
import { carriedName, carriedNamespace, definedName } from "./adjudicators";

type FilterInput = Binding | KubernetesObject | AdmissionRequest | string[] | undefined;

const prefix = "Ignoring Admission Callback:";

export const bindingKubernetesObjectLogMessage = (
  subject: string,
  filterInput: FilterInput,
  filterCriteria?: FilterInput,
): string => {
  let logMessage = "";
  if (subject === "group") {
    logMessage = `${prefix} Binding defines ${subject} '${definedName(filterInput)}' but Request declares '${carriedName(filterCriteria)}'.`;
  } else {
    logMessage = `${prefix} Binding defines ${subject} '${definedName(filterInput)}' but Object carries '${carriedName(filterCriteria)}'.`;
  }
  return logMessage;
};

export const bindingAdmissionRequestLogMessage = (subject: string, binding: FilterInput, request?: FilterInput) =>
  `${prefix} Binding defines ${subject} '${definedName(binding)}' but Request declares '${carriedName(request)}'.`;

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
