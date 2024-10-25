import { AdmissionRequest, Binding } from "../types";

//TODO: Dupe'd declaration
type FilterParams = {
  binding: Binding;
  request: AdmissionRequest;
  capabilityNamespaces: string[];
  ignoredNamespaces?: string[];
};

interface Filter {
  (data: FilterParams): string;
}

export class FilterChain {
  private filters: Filter[] = [];

  public addFilter(filter: Filter): FilterChain {
    this.filters.push(filter);
    return this;
  }
  public execute(data: FilterParams): string {
    return this.filters.reduce((result, filter) => {
      result += filter(data);
      // The result of each filter is passed as a new concatenated string
      return result;
    }, "");
  }
}
