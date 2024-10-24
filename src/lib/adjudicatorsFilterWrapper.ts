import { carriedName, definedNameRegex, mismatchedNameRegex } from "./adjudicators";
import { AdmissionRequest, Binding } from "./types";

//TODO: Dupe'd declaration
type FilterParams = { binding: Binding; request: AdmissionRequest };
const prefix = "Ignoring Admission Callback:";

export const mismatchedNameRegexFilter = (data: FilterParams): string => {
  const result = mismatchedNameRegex(data.binding, data.request.operation)
    ? `${prefix} Binding defines name regex '${definedNameRegex(data.binding)}' ` +
      `but Object carries '${carriedName(data.request.operation)}'.`
    : "";
  return result;
};
