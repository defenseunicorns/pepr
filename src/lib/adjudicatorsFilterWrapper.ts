import {
  carriedName,
  carriedNamespace,
  definedNameRegex,
  definedNamespaceRegexes,
  definedNamespaces,
  mismatchedNameRegex,
  mismatchedNamespace,
  mismatchedNamespaceRegex,
  uncarryableNamespace,
} from "./adjudicators";
import { AdmissionRequest, Binding, Operation } from "./types";

//TODO: Dupe'd declaration
type FilterParams = { binding: Binding; request: AdmissionRequest; capabilityNamespaces: string[] };
const prefix = "Ignoring Admission Callback:";

export const mismatchedNameRegexFilter = (data: FilterParams): string => {
  const obj = data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object;
  const result = mismatchedNameRegex(data.binding, obj)
    ? `${prefix} Binding defines name regex '${definedNameRegex(data.binding)}' but Object carries '${carriedName(data.request.operation)}'.`
    : "";
  return result;
};

export const mismatchedNamespaceRegexFilter = (data: FilterParams): string => {
  const obj = data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object;
  const result = mismatchedNamespaceRegex(data.binding, obj)
    ? `${prefix} Binding defines namespace regexes '${JSON.stringify(definedNamespaceRegexes(data.binding))}' but Object carries '${carriedNamespace(obj)}'.`
    : "";

  return result;
};

export const mismatchedNamespaceFilter = (data: FilterParams): string => {
  const obj = data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object;
  const result = mismatchedNamespace(data.binding, obj)
    ? `${prefix} Binding defines namespaces '${JSON.stringify(definedNamespaces(data.binding))}' but Object carries '${carriedNamespace(obj)}'.`
    : "";

  return result;
};

export const uncarryableNamespaceFilter = (data: FilterParams): string => {
  const obj = data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object;
  const result = uncarryableNamespace(data.capabilityNamespaces, obj)
    ? `${prefix} Object carries namespace '${carriedNamespace(obj)}' but namespaces allowed by Capability are '${JSON.stringify(data.capabilityNamespaces)}'.`
    : "";

  return result;
};
