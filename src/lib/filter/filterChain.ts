import { FilterParams } from "../types";

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
    //TODO: Break on first "failure"?
    //TODO: Dev flag for detailed logging? Check some envar?
    return this.filters.reduce((result, filter) => {
      result += filter(data);
      // The result of each filter is passed as a new concatenated string
      return result;
    }, "");
  }
}
