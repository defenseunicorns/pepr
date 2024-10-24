/* eslint-disable complexity */
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { AdmissionRequest, Binding, Operation } from "./types";
import {
  carriedAnnotations,
  carriedLabels,
  carriedName,
  carriedNamespace,
  carriesIgnoredNamespace,
  declaredGroup,
  declaredKind,
  declaredOperation,
  declaredVersion,
  definedAnnotations,
  definedEvent,
  definedGroup,
  definedKind,
  definedLabels,
  definedName,
  definedNameRegex,
  definedNamespaceRegexes,
  definedNamespaces,
  definedVersion,
  misboundDeleteWithDeletionTimestamp,
  mismatchedAnnotations,
  mismatchedDeletionTimestamp,
  mismatchedEvent,
  mismatchedGroup,
  mismatchedKind,
  mismatchedLabels,
  mismatchedName,
  mismatchedNameRegex,
  mismatchedNamespace,
  mismatchedNamespaceRegex,
  mismatchedVersion,
  unbindableNamespaces,
  uncarryableNamespace,
} from "./adjudicators";
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
  uncarryableNamespaceFilter,
} from "./adjudicatorsFilterWrapper";

/**
 * shouldSkipRequest determines if a request should be skipped based on the binding filters.
 *
 * @param binding the action binding
 * @param req the incoming request
 * @returns
 */
export function shouldSkipRequest(
  binding: Binding,
  req: AdmissionRequest,
  capabilityNamespaces: string[],
  ignoredNamespaces?: string[],
): string {
  const prefix = "Ignoring Admission Callback:";
  const obj = req.operation === Operation.DELETE ? req.oldObject : req.object;

  const admissionFilterMessage = misboundDeleteWithDeletionTimestamp(binding)
    ? `${prefix} Cannot use deletionTimestamp filter on a DELETE operation.`
    : mismatchedDeletionTimestamp(binding, obj)
      ? `${prefix} Binding defines deletionTimestamp but Object does not carry it.`
      : mismatchedEvent(binding, req)
        ? `${prefix} Binding defines event '${definedEvent(binding)}' but ` +
          `Request declares '${declaredOperation(req)}'.`
        : mismatchedName(binding, obj)
          ? `${prefix} Binding defines name '${definedName(binding)}' but Object carries '${carriedName(obj)}'.`
          : mismatchedGroup(binding, req)
            ? `${prefix} Binding defines group '${definedGroup(binding)}' but ` +
              `Request declares '${declaredGroup(req)}'.`
            : mismatchedVersion(binding, req)
              ? `${prefix} Binding defines version '${definedVersion(binding)}' but ` +
                `Request declares '${declaredVersion(req)}'.`
              : mismatchedKind(binding, req)
                ? `${prefix} Binding defines kind '${definedKind(binding)}' but ` +
                  `Request declares '${declaredKind(req)}'.`
                : unbindableNamespaces(capabilityNamespaces, binding)
                  ? `${prefix} Binding defines namespaces ${JSON.stringify(definedNamespaces(binding))} ` +
                    `but namespaces allowed by Capability are '${JSON.stringify(capabilityNamespaces)}'.`
                  : uncarryableNamespace(capabilityNamespaces, obj)
                    ? `${prefix} Object carries namespace '${carriedNamespace(obj)}' ` +
                      `but namespaces allowed by Capability are '${JSON.stringify(capabilityNamespaces)}'.`
                    : mismatchedNamespace(binding, obj)
                      ? `${prefix} Binding defines namespaces '${JSON.stringify(definedNamespaces(binding))}' ` +
                        `but Object carries '${carriedNamespace(obj)}'.`
                      : mismatchedLabels(binding, obj)
                        ? `${prefix} Binding defines labels '${JSON.stringify(definedLabels(binding))}' ` +
                          `but Object carries '${JSON.stringify(carriedLabels(obj))}'.`
                        : mismatchedAnnotations(binding, obj)
                          ? `${prefix} Binding defines annotations '${JSON.stringify(definedAnnotations(binding))}' ` +
                            `but Object carries '${JSON.stringify(carriedAnnotations(obj))}'.`
                          : mismatchedNamespaceRegex(binding, obj)
                            ? `${prefix} Binding defines namespace regexes ` +
                              `'${JSON.stringify(definedNamespaceRegexes(binding))}' ` +
                              `but Object carries '${carriedNamespace(obj)}'.`
                            : mismatchedNameRegex(binding, obj)
                              ? `${prefix} Binding defines name regex '${definedNameRegex(binding)}' ` +
                                `but Object carries '${carriedName(obj)}'.`
                              : carriesIgnoredNamespace(ignoredNamespaces, obj)
                                ? `${prefix} Object carries namespace '${carriedNamespace(obj)}' ` +
                                  `but ignored namespaces include '${JSON.stringify(ignoredNamespaces)}'.`
                                : "";

  return admissionFilterMessage;
}

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

export const shouldSkipRequestWithFilterChain = (
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

  const admissionFilterMessage = filterChain.execute({
    binding,
    request: req,
    capabilityNamespaces,
    ignoredNamespaces,
  });
  return admissionFilterMessage;
};
