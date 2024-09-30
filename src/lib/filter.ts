// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { AdmissionRequest, Binding, Operation } from "./types";
// import { ignoredNSObjectViolation, matchesRegex } from "./helpers";
import {
  carriesIgnoredNamespace,
  misboundDeleteWithDeletionTimestamp,
  mismatchedDeletionTimestamp,
  mismatchedAnnotations,
  mismatchedLabels,
  mismatchedName,
  mismatchedNameRegex,
  mismatchedNamespace,
  mismatchedNamespaceRegex,
  mismatchedEvent,
  mismatchedGroup,
  mismatchedVersion,
  mismatchedKind,
  unbindableNamespaces,
  uncarryableNamespace,
} from "./adjudicators";

export function shouldSkipRequestRegex(
  binding: Binding,
  req: AdmissionRequest,
  capabilityNamespaces: string[],
  ignoredNamespaces?: string[],
): boolean {
  return shouldSkipRequest(binding, req, capabilityNamespaces, ignoredNamespaces);

  // const result = shouldSkipRequest(binding, req, capabilityNamespaces, ignoredNamespaces);

  // const obj = req.operation === Operation.DELETE ? req.oldObject : req.object;
  // if (!result) {
  //   if (mismatchedNamespaceRegex(binding, obj)) {
  //     return true;
  //   }

  //   if (mismatchedNameRegex(binding, obj)) {
  //     return true;
  //   }
  // }

  // if (carriesIgnoredNamespace(ignoredNamespaces, obj)) {
  //   return true;
  // }

  // return result;
}

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
): boolean {
  const obj = req.operation === Operation.DELETE ? req.oldObject : req.object;

  // prettier-ignore
  return (
    misboundDeleteWithDeletionTimestamp(binding) ? true :
    mismatchedDeletionTimestamp(binding, obj) ? true :
    mismatchedEvent(binding, req) ? true :
    mismatchedName(binding, obj) ? true :
    mismatchedGroup(binding, req) ? true :
    mismatchedVersion(binding, req) ? true :
    mismatchedKind(binding, req) ? true :
    unbindableNamespaces(capabilityNamespaces, binding) ? true :
    uncarryableNamespace(capabilityNamespaces, obj) ? true :
    mismatchedNamespace(binding, obj) ? true :
    mismatchedLabels(binding, obj) ? true :
    mismatchedAnnotations(binding, obj) ? true :
    mismatchedNamespaceRegex(binding, obj) ? true :
    mismatchedNameRegex(binding, obj) ? true :
    carriesIgnoredNamespace(ignoredNamespaces, obj) ? true :

    false
  );
}
