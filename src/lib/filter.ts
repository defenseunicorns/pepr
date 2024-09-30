// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { AdmissionRequest, Binding, Operation } from "./types";
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
