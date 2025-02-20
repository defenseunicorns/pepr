// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Event, Operation } from "../../enums";
import { AdmissionRequest, Binding } from "../../types";
import { __, allPass, any, anyPass, curry, difference, equals, gt, length, not, nthArg, pipe } from "ramda";
import { KubernetesObject } from "kubernetes-fluent-client";
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
  definesDelete,
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
  carriesNamespace,
  missingDeletionTimestamp,
} from "./kubernetesObject";
import { declaredOperation, declaredGroup, declaredVersion, declaredKind } from "./admissionRequest";

/*
  Naming scheme:
  - AdmissionRequest - "declares" / "neglects"
  - KubernetesObject - "carries" / "missing"
  - Binding - "defines" / "ignores"
*/

/*
  post-collection comparitors
*/
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
  pipe((binding, kubernetesObject) => new RegExp(definedNameRegex(binding)).test(carriedName(kubernetesObject)), not),
]);

export const bindsToKind = curry(
  allPass([pipe(nthArg(0), definedKind, equals(""), not), pipe((binding, kind) => definedKind(binding) === kind)]),
);
export const bindsToNamespace = curry(pipe(bindsToKind(__, "Namespace")));
export const misboundNamespace = allPass([bindsToNamespace, definesNamespaces]);

export const mismatchedNamespace = allPass([
  pipe(nthArg(0), definesNamespaces),
  pipe((binding, kubernetesObject) => definedNamespaces(binding).includes(carriedNamespace(kubernetesObject)), not),
]);

export const mismatchedNamespaceRegex = allPass([
  pipe(nthArg(0), definesNamespaceRegexes),
  pipe((binding, kubernetesObject) =>
    pipe(
      any((regEx: string) => new RegExp(regEx).test(carriedNamespace(kubernetesObject))),
      not,
    )(definedNamespaceRegexes(binding)),
  ),
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
  pipe((binding, kubernetesObject) => metasMismatch(definedAnnotations(binding), carriedAnnotations(kubernetesObject))),
]);

export const mismatchedLabels = allPass([
  pipe(nthArg(0), definesLabels),
  pipe((binding, kubernetesObject) => metasMismatch(definedLabels(binding), carriedLabels(kubernetesObject))),
]);

/*
 * If the object does not have a namespace, and it is not a namespace,
 * then we must return false because it cannot be uncarryable
 */
export const uncarryableNamespace = allPass([
  pipe(nthArg(0), length, gt(__, 0)),
  pipe((namespaceSelector, kubernetesObject) => {
    if (kubernetesObject?.kind === "Namespace") {
      return namespaceSelector.includes(kubernetesObject?.metadata?.name);
    }
    if (carriesNamespace(kubernetesObject)) {
      return namespaceSelector.includes(carriedNamespace(kubernetesObject));
    }
    return true;
  }, not),
]);

export const missingCarriableNamespace = allPass([
  pipe(nthArg(0), length, gt(__, 0)),
  pipe((namespaceSelector: string[], kubernetesObject: KubernetesObject): boolean =>
    kubernetesObject.kind === "Namespace"
      ? !namespaceSelector.includes(kubernetesObject.metadata!.name!)
      : !carriesNamespace(kubernetesObject),
  ),
]);

/*
 * If the object does not have a namespace, and it is not a namespace,
 * then we must return false because it cannot be ignored
 */
export const carriesIgnoredNamespace = allPass([
  pipe(nthArg(0), length, gt(__, 0)),
  pipe((namespaceSelector, kubernetesObject) => {
    if (kubernetesObject?.kind === "Namespace") {
      return namespaceSelector.includes(kubernetesObject?.metadata?.name);
    }
    if (carriesNamespace(kubernetesObject)) {
      return namespaceSelector.includes(carriedNamespace(kubernetesObject));
    }

    return false;
  }),
]);

export const unbindableNamespaces = allPass([
  pipe(nthArg(0), length, gt(__, 0)),
  pipe(nthArg(1), definesNamespaces),
  pipe(
    (namespaceSelector, binding) => difference(definedNamespaces(binding), namespaceSelector),
    length,
    equals(0),
    not,
  ),
]);

export const misboundDeleteWithDeletionTimestamp = allPass([definesDelete, definesDeletionTimestamp]);

export const operationMatchesEvent = anyPass([
  pipe(nthArg(1), equals(Event.ANY)),
  pipe((operation: Operation, event: Event): boolean => operation.valueOf() === event.valueOf()),
  pipe((operation: Operation, event: Event): boolean => (operation ? event.includes(operation) : false)),
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
