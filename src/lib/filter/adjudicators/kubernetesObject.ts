// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { __, allPass, complement, defaultTo, equals, length, gt, not, nthArg, pipe } from "ramda";
import { KubernetesObject } from "kubernetes-fluent-client";

export const carriesDeletionTimestamp = pipe(
  kubernetesObject => !!kubernetesObject.metadata?.deletionTimestamp,
  defaultTo(false),
);
export const missingDeletionTimestamp = complement(carriesDeletionTimestamp);

export const carriedKind = pipe(
  (kubernetesObject: KubernetesObject): string | undefined => kubernetesObject?.kind,
  defaultTo("not set"),
);
export const carriedVersion = pipe(
  (kubernetesObject: KubernetesObject): string | undefined => kubernetesObject?.metadata?.resourceVersion,
  defaultTo("not set"),
);
export const carriedName = pipe(
  (kubernetesObject: KubernetesObject): string | undefined => kubernetesObject?.metadata?.name,
  defaultTo(""),
);
export const carriesName = pipe(carriedName, equals(""), not);
export const missingName = complement(carriesName);

export const carriedNamespace = pipe(
  (kubernetesObject: KubernetesObject): string | undefined => kubernetesObject?.metadata?.namespace,
  defaultTo(""),
);

export const carriesNamespace = pipe(carriedNamespace, equals(""), not);

export const carriedAnnotations = pipe(
  (kubernetesObject: KubernetesObject): { [key: string]: string } | undefined =>
    kubernetesObject?.metadata?.annotations,
  defaultTo({}),
);
export const carriesAnnotations = pipe(carriedAnnotations, equals({}), not);

export const carriedLabels = pipe(
  (kubernetesObject: KubernetesObject): { [key: string]: string } | undefined => kubernetesObject?.metadata?.labels,
  defaultTo({}),
);
export const carriesLabels = pipe(carriedLabels, equals({}), not);

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
