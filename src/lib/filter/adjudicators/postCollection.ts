// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { __, allPass, curry, difference, equals, gt, length, not, nthArg, pipe } from "ramda";
import { KubernetesObject } from "kubernetes-fluent-client";
import { definedKind, definedNamespaces, definesDelete, definesDeletionTimestamp, definesNamespaces } from "./binding";
import { carriedNamespace, carriesNamespace } from "./kubernetesObject";

/*
  Naming scheme:
  - AdmissionRequest - "declares" / "neglects"
  - KubernetesObject - "carries" / "missing"
  - Binding - "defines" / "ignores"
*/

export const bindsToKind = curry(
  allPass([pipe(nthArg(0), definedKind, equals(""), not), pipe((binding, kind) => definedKind(binding) === kind)]),
);
export const bindsToNamespace = curry(pipe(bindsToKind(__, "Namespace")));
export const misboundNamespace = allPass([bindsToNamespace, definesNamespaces]);

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
