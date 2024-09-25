// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import {
  definesDeletionTimestamp,
  ignoredNSObjectViolation,
  matchesRegex,
  mismatchedDeletionTimestamp,
  definesName,
  definedName,
} from "./helpers";
import { AdmissionRequest, Binding, Event, Operation } from "./types";
import logger from "./logger";
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

export const declaredName = pipe(request => request?.name, defaultTo(""));
export const mismatchedName = allPass([
  pipe(nthArg(0), definesName),
  pipe((binding, request) => definedName(binding) !== declaredName(request)),
]);

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

/**
 * shouldSkipRequest determines if a request should be skipped based on the binding filters.
 *
 * @param binding the action binding
 * @param req the incoming request
 * @returns
 */
export function shouldSkipRequest(binding: Binding, req: AdmissionRequest, capabilityNamespaces: string[]): boolean {
  const { namespaces, labels, annotations } = binding.filters || {};
  const operation = req.operation.toUpperCase();
  const uid = req.uid;
  // Use the old object if the request is a DELETE operation
  const srcObject = operation === Operation.DELETE ? req.oldObject : req.object;
  const { metadata } = srcObject || {};
  const combinedNamespaces = [...namespaces, ...capabilityNamespaces];

  const obj = req.operation === Operation.DELETE ? req.oldObject : req.object;

  if (misboundDeleteWithDeletionTimestamp(binding)) {
    return true;
  }
  // if (definesDelete(binding) && definesDeletionTimestamp(binding)) {
  //   return true;
  // }
  // if (binding.event.includes(Event.Delete) && binding.filters?.deletionTimestamp) {
  //   return true;
  // }

  if (mismatchedDeletionTimestamp(binding, obj)) {
    return true;
  }
  // if (binding.filters?.deletionTimestamp && !req.object.metadata?.deletionTimestamp) {
  //   return true;
  // }

  if (mismatchedEvent(binding, req)) {
    return true;
  }
  // if (!binding.event.includes(operation) && !binding.event.includes(Event.Any)) {
  //   return true;
  // }

  if (mismatchedName(binding, req)) {
    return true;
  }
  // if (name && name !== req.name) {
  //   return true;
  // }

  if (mismatchedGroup(binding, req)) {
    return true;
  }
  // if (group && group !== req.kind.group) {
  //   return true;
  // }

  if (mismatchedVersion(binding, req)) {
    return true;
  }
  // if (version && version !== req.kind.version) {
  //   return true;
  // }

  if (mismatchedKind(binding, req)) {
    return true;
  }
  // if (kind !== req.kind.kind) {
  //   return true;
  // }

  // Test for matching namespaces
  if (
    (combinedNamespaces.length && !combinedNamespaces.includes(req.namespace || "")) ||
    (!namespaces.includes(req.namespace || "") && capabilityNamespaces.length !== 0 && namespaces.length !== 0)
  ) {
    let type = "";
    let label = "";

    if (binding.isMutate) {
      type = "Mutate";
      label = binding.mutateCallback!.name;
    } else if (binding.isValidate) {
      type = "Validate";
      label = binding.validateCallback!.name;
    } else if (binding.isWatch) {
      type = "Watch";
      label = binding.watchCallback!.name;
    }

    logger.debug({ uid }, `${type} binding (${label}) does not match request namespace "${req.namespace}"`);

    return true;
  }

  // Test for matching labels
  for (const [key, value] of Object.entries(labels)) {
    const testKey = metadata?.labels?.[key];

    // First check if the label exists
    if (!testKey) {
      logger.debug({ uid }, `Label ${key} does not exist`);
      return true;
    }

    // Then check if the value matches, if specified
    if (value && testKey !== value) {
      logger.debug({ uid }, `${testKey} does not match ${value}`);
      return true;
    }
  }

  // Test for matching annotations
  for (const [key, value] of Object.entries(annotations)) {
    const testKey = metadata?.annotations?.[key];

    // First check if the annotation exists
    if (!testKey) {
      logger.debug({ uid }, `Annotation ${key} does not exist`);
      return true;
    }

    // Then check if the value matches, if specified
    if (value && testKey !== value) {
      logger.debug({ uid }, `${testKey} does not match ${value}`);
      return true;
    }
  }

  // No failed filters, so we should not skip this request
  return false;
}
