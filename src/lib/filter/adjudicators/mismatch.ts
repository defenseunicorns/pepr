// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Binding } from "../../types";
import { allPass, anyPass, equals, not, nthArg, pipe } from "ramda";
import Log from "../../telemetry/logger";
import {
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
  definesAnnotations,
  definesDeletionTimestamp,
  definesGroup,
  definesKind,
  definesLabels,
  definesName,
  definesNameRegex,
  definesNamespaceRegexes,
  definesNamespaces,
  definesVersion,
} from "./binding";
import {
  carriedAnnotations,
  carriedLabels,
  carriedName,
  carriedNamespace,
  missingDeletionTimestamp,
} from "./kubernetesObject";
import {
  declaredOperation,
  declaredGroup,
  declaredVersion,
  declaredKind,
} from "./admissionRequest";
import { Event, Operation } from "../../enums";
import { AdmissionRequest } from "../../common-types";

export const mismatchedDeletionTimestamp = allPass([
  pipe(nthArg(0), definesDeletionTimestamp),
  pipe(nthArg(1), missingDeletionTimestamp),
]);

export const mismatchedName = allPass([
  pipe(nthArg(0), definesName),
  pipe((binding, kubernetesObject) => definedName(binding) !== carriedName(kubernetesObject)),
]);

export const mismatchedNameRegex = allPass([
  pipe(nthArg(0), definesNameRegex),
  (binding: Binding, kubernetesObject: { metadata?: { name?: string } }): boolean => {
    try {
      return !new RegExp(definedNameRegex(binding)).test(carriedName(kubernetesObject));
    } catch (e) {
      Log.warn(`Invalid regexName pattern "${definedNameRegex(binding)}": ${e}`);
      return true;
    }
  },
]);

export const mismatchedNamespace = allPass([
  pipe(nthArg(0), definesNamespaces),
  pipe(
    (binding, kubernetesObject) =>
      definedNamespaces(binding).includes(carriedNamespace(kubernetesObject)),
    not,
  ),
]);

export const mismatchedNamespaceRegex = allPass([
  pipe(nthArg(0), definesNamespaceRegexes),
  (binding: Binding, kubernetesObject: { metadata?: { namespace?: string } }): boolean => {
    const namespace = carriedNamespace(kubernetesObject);
    // Compile all patterns upfront so an invalid regex anywhere in the array
    // is caught before short-circuit matching can skip over it.
    let compiled: RegExp[];
    try {
      compiled = definedNamespaceRegexes(binding).map((regEx: string) => new RegExp(regEx));
    } catch (e) {
      Log.warn(`Invalid regexNamespaces pattern in binding: ${e}`);
      return true;
    }
    return !compiled.some((re: RegExp) => re.test(namespace));
  },
]);

export const metasMismatch = pipe(
  (defined, carried) => {
    const result = { defined, carried, unalike: {} };

    result.unalike = Object.entries(result.defined)
      .map(([key, value]) => {
        const keyMissing = !Object.hasOwn(result.carried, key);
        const noValue = !value;
        const valMissing = !result.carried[key];
        const valDiffers = result.carried[key] !== result.defined[key];

        // prettier-ignore
        return (
          keyMissing ? { [key]: value } :
            noValue ? {} :
              valMissing ? { [key]: value } :
                valDiffers ? { [key]: value } :
                  {}
        )
      })
      .reduce((acc, cur) => ({ ...acc, ...cur }), {});

    return result.unalike;
  },
  unalike => Object.keys(unalike).length > 0,
);

export const mismatchedAnnotations = allPass([
  pipe(nthArg(0), definesAnnotations),
  pipe((binding, kubernetesObject) =>
    metasMismatch(definedAnnotations(binding), carriedAnnotations(kubernetesObject)),
  ),
]);

export const mismatchedLabels = allPass([
  pipe(nthArg(0), definesLabels),
  pipe((binding, kubernetesObject) =>
    metasMismatch(definedLabels(binding), carriedLabels(kubernetesObject)),
  ),
]);

export const mismatchedEvent = pipe(
  (binding: Binding, request: AdmissionRequest): boolean =>
    operationMatchesEvent(declaredOperation(request), definedEvent(binding)),
  not,
);

export const mismatchedGroup = allPass([
  pipe(nthArg(0), definesGroup),
  pipe((binding, request) => definedGroup(binding) !== declaredGroup(request)),
]);

export const mismatchedVersion = allPass([
  pipe(nthArg(0), definesVersion),
  pipe((binding, request) => definedVersion(binding) !== declaredVersion(request)),
]);

export const mismatchedKind = allPass([
  pipe(nthArg(0), definesKind),
  pipe((binding, request) => definedKind(binding) !== declaredKind(request)),
]);
export const operationMatchesEvent = anyPass([
  pipe(nthArg(1), equals(Event.ANY)),
  pipe((operation: Operation, event: Event): boolean => operation.valueOf() === event.valueOf()),
  pipe((operation: Operation, event: Event): boolean =>
    operation ? event.includes(operation) : false,
  ),
]);
