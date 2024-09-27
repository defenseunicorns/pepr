// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { AdmissionRequest, Binding, Operation } from "./types";
import { ignoredNSObjectViolation, matchesRegex } from "./helpers";
import {
  misboundDeleteWithDeletionTimestamp,
  mismatchedDeletionTimestamp,
  mismatchedAnnotations,
  mismatchedLabels,
  mismatchedName,
  mismatchedNamespace,
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
  const { regexNamespaces, regexName } = binding.filters || {};
  const result = shouldSkipRequest(binding, req, capabilityNamespaces);
  const operation = req.operation.toUpperCase();
  if (!result) {
    if (regexNamespaces && regexNamespaces.length > 0) {
      for (const regexNamespace of regexNamespaces) {
        if (
          !matchesRegex(
            regexNamespace,
            (operation === Operation.DELETE ? req.oldObject?.metadata?.namespace : req.object.metadata?.namespace) ||
              "",
          )
        ) {
          return true;
        }
      }
    }

    if (
      regexName &&
      regexName !== "" &&
      !matchesRegex(
        regexName,
        (operation === Operation.DELETE ? req.oldObject?.metadata?.name : req.object.metadata?.name) || "",
      )
    ) {
      return true;
    }
  }

  // check ignored namespaces
  const ignoredNS = ignoredNSObjectViolation(req, {}, ignoredNamespaces);
  if (ignoredNS) {
    return true;
  }

  return result;
}

/**
 * shouldSkipRequest determines if a request should be skipped based on the binding filters.
 *
 * @param binding the action binding
 * @param req the incoming request
 * @returns
 */
export function shouldSkipRequest(binding: Binding, req: AdmissionRequest, capabilityNamespaces: string[]): boolean {
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

    false
  );
}
