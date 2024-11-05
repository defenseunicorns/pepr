// // SPDX-License-Identifier: Apache-2.0
// // SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { KubernetesObject } from "kubernetes-fluent-client";
import { Binding } from "../types";
import {
  carriedAnnotations,
  carriedLabels,
  carriedName,
  carriedNamespace,
  carriesIgnoredNamespace,
  definedAnnotations,
  definedLabels,
  definedName,
  definedNameRegex,
  definedNamespaces,
  definedNamespaceRegexes,
  misboundNamespace,
  mismatchedAnnotations,
  mismatchedDeletionTimestamp,
  mismatchedLabels,
  mismatchedName,
  mismatchedNameRegex,
  mismatchedNamespace,
  mismatchedNamespaceRegex,
  unbindableNamespaces,
  uncarryableNamespace,
} from "./adjudicators";

/**
 * Decide to run callback after the event comes back from API Server
 **/
export function filterNoMatchReason(
  binding: Partial<Binding>,
  obj: Partial<KubernetesObject>,
  capabilityNamespaces: string[],
  ignoredNamespaces?: string[],
): string {
  const prefix = "Ignoring Watch Callback:";

  // prettier-ignore
  return (
    mismatchedDeletionTimestamp(binding, obj) ?
      `${prefix} Binding defines deletionTimestamp but Object does not carry it.` :

    mismatchedName(binding, obj) ?
      `${prefix} Binding defines name '${definedName(binding)}' but Object carries '${carriedName(obj)}'.` :

    misboundNamespace(binding) ?
      `${prefix} Cannot use namespace filter on a namespace object.` :

    mismatchedLabels(binding, obj) ?
      (
        `${prefix} Binding defines labels '${JSON.stringify(definedLabels(binding))}' ` +
        `but Object carries '${JSON.stringify(carriedLabels(obj))}'.`
      ) :

    mismatchedAnnotations(binding, obj) ?
      (
        `${prefix} Binding defines annotations '${JSON.stringify(definedAnnotations(binding))}' ` +
        `but Object carries '${JSON.stringify(carriedAnnotations(obj))}'.`
      ) :

    uncarryableNamespace(capabilityNamespaces, obj) ?
      (
        `${prefix} Object carries namespace '${carriedNamespace(obj)}' ` +
        `but namespaces allowed by Capability are '${JSON.stringify(capabilityNamespaces)}'.`
      ) :

    unbindableNamespaces(capabilityNamespaces, binding) ?
      (
        `${prefix} Binding defines namespaces ${JSON.stringify(definedNamespaces(binding))} ` +
        `but namespaces allowed by Capability are '${JSON.stringify(capabilityNamespaces)}'.`
      ) :

    mismatchedNamespace(binding, obj) ?
      (
        `${prefix} Binding defines namespaces '${JSON.stringify(definedNamespaces(binding))}' ` +
        `but Object carries '${carriedNamespace(obj)}'.`
      ) :

    mismatchedNamespaceRegex(binding, obj) ?
      (
        `${prefix} Binding defines namespace regexes ` +
        `'${JSON.stringify(definedNamespaceRegexes(binding))}' ` +
        `but Object carries '${carriedNamespace(obj)}'.`
      ) :

    mismatchedNameRegex(binding, obj) ?
      (
        `${prefix} Binding defines name regex '${definedNameRegex(binding)}' ` +
        `but Object carries '${carriedName(obj)}'.`
      ) :

    carriesIgnoredNamespace(ignoredNamespaces, obj) ?
      (
        `${prefix} Object carries namespace '${carriedNamespace(obj)}' ` +
        `but ignored namespaces include '${JSON.stringify(ignoredNamespaces)}'.`
      ) :

    ""
  );
}

// // SPDX-License-Identifier: Apache-2.0
// // SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// import { AdmissionRequest, Binding } from "../types";
// import {
//   carriesIgnoredNamespaceFilter,
//   misboundDeleteWithDeletionTimestampFilter,
//   mismatchedAnnotationsFilter,
//   mismatchedDeletionTimestampFilter,
//   mismatchedEventFilter,
//   mismatchedGroupFilter,
//   mismatchedKindFilter,
//   mismatchedLabelsFilter,
//   mismatchedNameFilter,
//   mismatchedNameRegexFilter,
//   mismatchedNamespaceFilter,
//   mismatchedNamespaceRegexFilter,
//   mismatchedVersionFilter,
//   unbindableNamespacesFilter,
//   uncarryableNamespaceFilter,
// } from "./filtersWithLogs";
// import { FilterChain } from "./filterChain";

// /**
//  * shouldSkipRequest determines if a request should be skipped based on the binding filters.
//  *
//  * @param binding the action binding
//  * @param req the incoming request
//  * @returns
//  */
// export const shouldSkipRequest = (
//   binding: Binding,
//   req: AdmissionRequest,
//   capabilityNamespaces: string[],
//   ignoredNamespaces?: string[],
// ): string => {
//   const filterChain = new FilterChain();

//   filterChain
//     .addFilter(misboundDeleteWithDeletionTimestampFilter)
//     .addFilter(mismatchedDeletionTimestampFilter)
//     .addFilter(mismatchedEventFilter)
//     .addFilter(mismatchedNameFilter)
//     .addFilter(mismatchedGroupFilter)
//     .addFilter(mismatchedVersionFilter)
//     .addFilter(mismatchedKindFilter)
//     .addFilter(unbindableNamespacesFilter)
//     .addFilter(uncarryableNamespaceFilter)
//     .addFilter(mismatchedNamespaceFilter)
//     .addFilter(mismatchedLabelsFilter)
//     .addFilter(mismatchedAnnotationsFilter)
//     .addFilter(mismatchedNamespaceRegexFilter)
//     .addFilter(mismatchedNameRegexFilter)
//     .addFilter(carriesIgnoredNamespaceFilter);

//   const admissionFilterMessage = filterChain.execute({
//     binding,
//     request: req,
//     capabilityNamespaces,
//     ignoredNamespaces,
//   });
//   return admissionFilterMessage;
// };
