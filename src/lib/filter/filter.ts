/* eslint-disable complexity */
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { AdmissionRequest, Binding } from "../types";
import {
  carriesIgnoredNamespacesFilter,
  mismatchedAnnotationsFilter,
  mismatchedDeletionTimestampFilter,
  mismatchedGroupFilter,
  mismatchedKindFilter,
  mismatchedLabelsFilter,
  mismatchedNameFilter,
  mismatchedNameRegexFilter,
  mismatchedNamespaceFilter,
  mismatchedNamespaceRegexFilter,
  mismatchedVersionFilter,
  unbindableNamespacesFilter,
  uncarryableNamespaceFilter,
} from "./adjudicatorsFilterWrapper";

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

/**
 * shouldSkipRequest determines if a request should be skipped based on the binding filters.
 *
 * @param binding the action binding
 * @param req the incoming request
 * @returns
 */
export const shouldSkipRequest = (
  binding: Binding,
  req: AdmissionRequest,
  capabilityNamespaces: string[],
  ignoredNamespaces?: string[],
): string => {
  // const obj = req.operation === Operation.DELETE ? req.oldObject : req.object;

  const filterChain = new FilterChain();

  filterChain.addFilter(mismatchedNameRegexFilter);
  filterChain.addFilter(mismatchedNamespaceFilter);
  filterChain.addFilter(mismatchedNamespaceRegexFilter);
  filterChain.addFilter(uncarryableNamespaceFilter);
  filterChain.addFilter(mismatchedDeletionTimestampFilter);
  filterChain.addFilter(mismatchedAnnotationsFilter);
  filterChain.addFilter(mismatchedLabelsFilter);
  filterChain.addFilter(mismatchedKindFilter);
  filterChain.addFilter(mismatchedGroupFilter);
  filterChain.addFilter(mismatchedVersionFilter);
  filterChain.addFilter(mismatchedNameFilter);
  filterChain.addFilter(carriesIgnoredNamespacesFilter);
  filterChain.addFilter(unbindableNamespacesFilter);

  const admissionFilterMessage = filterChain.execute({
    binding,
    request: req,
    capabilityNamespaces,
    ignoredNamespaces,
  });
  return admissionFilterMessage;
};
