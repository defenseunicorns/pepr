// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { AdmissionRequest, Binding } from "../types";
import {
  carriesIgnoredNamespaceFilter,
  misboundDeleteWithDeletionTimestampFilter,
  mismatchedAnnotationsFilter,
  mismatchedDeletionTimestampFilter,
  mismatchedEventFilter,
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
} from "./filtersWithLogs";
import { FilterChain } from "./filterChain";

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
  const filterChain = new FilterChain();

  filterChain
    .addFilter(misboundDeleteWithDeletionTimestampFilter)
    .addFilter(mismatchedDeletionTimestampFilter)
    .addFilter(mismatchedEventFilter)
    .addFilter(mismatchedNameFilter)
    .addFilter(mismatchedGroupFilter)
    .addFilter(mismatchedVersionFilter)
    .addFilter(mismatchedKindFilter)
    .addFilter(unbindableNamespacesFilter)
    .addFilter(uncarryableNamespaceFilter)
    .addFilter(mismatchedNamespaceFilter)
    .addFilter(mismatchedLabelsFilter)
    .addFilter(mismatchedAnnotationsFilter)
    .addFilter(mismatchedNamespaceRegexFilter)
    .addFilter(mismatchedNameRegexFilter)
    .addFilter(carriesIgnoredNamespaceFilter);

  const admissionFilterMessage = filterChain.execute({
    binding,
    request: req,
    capabilityNamespaces,
    ignoredNamespaces,
  });
  return admissionFilterMessage;
};
