// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import {
  definesDeletionTimestamp,
  ignoredNSObjectViolation,
  matchesRegex,
  mismatchedDeletionTimestamp,
  mismatchedName,
  unbindableNamespaces,
  uncarryableNamespace,
  mismatchedAnnotations,
  mismatchedLabels,
  mismatchedNamespace,
} from "./helpers";
import { AdmissionRequest, Binding, Event, Operation } from "./types";
import { allPass, anyPass, defaultTo, equals, not, nthArg, pipe } from "ramda";

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

export const definedEvent = pipe(binding => binding?.event, defaultTo(""));
export const definesDelete = pipe(definedEvent, equals(Operation.DELETE));

export const misboundDeleteWithDeletionTimestamp = allPass([definesDelete, definesDeletionTimestamp]);

export const operationMatchesEvent = anyPass([
  pipe(nthArg(1), equals(Event.Any)),
  pipe((op, evt) => op === evt),
  pipe((op, evt) => (op ? evt.includes(op) : false)),
]);

export const declaredOperation = pipe(request => request?.operation, defaultTo(""));
export const mismatchedEvent = pipe(
  (binding, request) => operationMatchesEvent(declaredOperation(request), definedEvent(binding)),
  not,
);

export const definedGroup = pipe(binding => binding?.kind?.group, defaultTo(""));
export const definesGroup = pipe(definedGroup, equals(""), not);

export const declaredGroup = pipe(request => request?.kind?.group, defaultTo(""));

export const mismatchedGroup = allPass([
  pipe(nthArg(0), definesGroup),
  pipe((binding, request) => definedGroup(binding) !== declaredGroup(request)),
]);

export const definedVersion = pipe(binding => binding?.kind?.version, defaultTo(""));
export const definesVersion = pipe(definedVersion, equals(""), not);

export const declaredVersion = pipe(request => request?.kind?.version, defaultTo(""));

export const mismatchedVersion = allPass([
  pipe(nthArg(0), definesVersion),
  pipe((binding, request) => definedVersion(binding) !== declaredVersion(request)),
]);

export const definedKind = pipe(binding => binding?.kind?.kind, defaultTo(""));
export const definesKind = pipe(definedKind, equals(""), not);

export const declaredKind = pipe(request => request?.kind?.kind, defaultTo(""));

export const mismatchedKind = allPass([
  pipe(nthArg(0), definesKind),
  pipe((binding, request) => definedKind(binding) !== declaredKind(request)),
]);

export const definedCategory = pipe(binding => {
  // prettier-ignore
  return (
    binding.isFinalize ? "Finalize" :
    binding.isWatch ? "Watch" :
    binding.isMutate ? "Mutate" :
    binding.isValidate ? "Validate" :
    ""
  );
});

export const definedCallback = pipe(binding => {
  // prettier-ignore
  return (
    binding.isFinalize ? binding.finalizeCallback :
    binding.isWatch ? binding.watchCallback :
    binding.isMutate ? binding.mutateCallback :
    binding.isValidate ? binding.validateCallback:
    null
  );
});
export const definedCallbackName = pipe(definedCallback, defaultTo({ name: "" }), cb => cb.name);

export const declaredUid = pipe(request => request?.uid, defaultTo(""));

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
