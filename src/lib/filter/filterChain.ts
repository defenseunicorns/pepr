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
    let result = "";
    for (const filter of this.filters) {
      result += filter(data);
      if (result !== "") {
        break;
      }
    }
    return result;
  }
}
