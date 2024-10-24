import {
  carriedName,
  carriedNamespace,
  definedNameRegex,
  definedNamespaceRegexes,
  mismatchedNameRegex,
  mismatchedNamespaceRegex,
} from "./adjudicators";
import { AdmissionRequest, Binding, Operation } from "./types";

//TODO: Dupe'd declaration
type FilterParams = { binding: Binding; request: AdmissionRequest };
const prefix = "Ignoring Admission Callback:";

export const mismatchedNameRegexFilter = (data: FilterParams): string => {
  const obj = data.request.operation === Operation.DELETE ? data.request.oldObject : data.request.object;
  const result = mismatchedNameRegex(data.binding, obj)
    ? `${prefix} Binding defines name regex '${definedNameRegex(data.binding)}' ` +
      `but Object carries '${carriedName(data.request.operation)}'.`
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
