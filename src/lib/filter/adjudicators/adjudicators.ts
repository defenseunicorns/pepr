// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Event, Operation } from "../../enums";
import { AdmissionRequest, Binding } from "../../types";
import {
  __,
  allPass,
  any,
  anyPass,
  complement,
  curry,
  defaultTo,
  difference,
  equals,
  gt,
  length,
  not,
  nthArg,
  pipe,
} from "ramda";
import { KubernetesObject } from "kubernetes-fluent-client";

/*
  Naming scheme:
  - AdmissionRequest - "declares" / "neglects"
  - KubernetesObject - "carries" / "missing"
  - Binding - "defines" / "ignores"
*/

/*
  AdmissionRequest collectors
*/
export const declaredOperation = pipe(
  (request: AdmissionRequest<KubernetesObject>): Operation => request?.operation,
  defaultTo(""),
);
export const declaredGroup = pipe(
  (request: AdmissionRequest<KubernetesObject>): string => request?.kind?.group,
  defaultTo(""),
);
export const declaredVersion = pipe(
  (request: AdmissionRequest<KubernetesObject>): string | undefined => request?.kind?.version,
  defaultTo(""),
);
export const declaredKind = pipe(
  (request: AdmissionRequest<KubernetesObject>): string => request?.kind?.kind,
  defaultTo(""),
);
export const declaredUid = pipe((request: AdmissionRequest<KubernetesObject>): string => request?.uid, defaultTo(""));

/*
  KubernetesObject collectors
*/
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
  Binding collectors
*/

export const definesDeletionTimestamp = pipe(
  (binding: Binding): boolean => binding?.filters?.deletionTimestamp ?? false,
  defaultTo(false),
);
export const ignoresDeletionTimestamp = complement(definesDeletionTimestamp);

export const definedName = pipe((binding: Binding): string => {
  return binding.filters.name;
}, defaultTo(""));
export const definesName = pipe(definedName, equals(""), not);
export const ignoresName = complement(definesName);

export const definedNameRegex = pipe(
  (binding: Partial<Binding>): string | undefined => binding.filters?.regexName,
  defaultTo(""),
);
export const definesNameRegex = pipe(definedNameRegex, equals(""), not);

export const definedNamespaces = pipe(binding => binding?.filters?.namespaces, defaultTo([]));
export const definesNamespaces = pipe(definedNamespaces, equals([]), not);

export const definedNamespaceRegexes = pipe(binding => binding?.filters?.regexNamespaces, defaultTo([]));
export const definesNamespaceRegexes = pipe(definedNamespaceRegexes, equals([]), not);

export const definedAnnotations = pipe((binding: Partial<Binding>) => binding?.filters?.annotations, defaultTo({}));
export const definesAnnotations = pipe(definedAnnotations, equals({}), not);

export const definedLabels = pipe((binding: Partial<Binding>) => binding?.filters?.labels, defaultTo({}));
export const definesLabels = pipe(definedLabels, equals({}), not);

export const definedEvent = (binding: Binding): Event => {
  return binding.event;
};

export const definesDelete = pipe(definedEvent, equals(Event.DELETE));

export const definedGroup = pipe((binding): string => binding?.kind?.group, defaultTo(""));
export const definesGroup = pipe(definedGroup, equals(""), not);

export const definedVersion = pipe(
  (binding: Partial<Binding>): string | undefined => binding?.kind?.version,
  defaultTo(""),
);
export const definesVersion = pipe(definedVersion, equals(""), not);

export const definedKind = pipe((binding): string => binding?.kind?.kind, defaultTo(""));
export const definesKind = pipe(definedKind, equals(""), not);

export const definedCategory = (binding: Partial<Binding>) => {
  // Ordering matters, finalize is a "watch"
  // prettier-ignore
  return binding.isFinalize ? "Finalize" :
    binding.isWatch ? "Watch" :
    binding.isMutate ? "Mutate" :
    binding.isValidate ? "Validate" :
    "";
};

export const definedCallback = (binding: Partial<Binding>) => {
  // Ordering matters, finalize is a "watch"
  // prettier-ignore
  return binding.isFinalize ? binding.finalizeCallback :
    binding.isWatch ? binding.watchCallback :
    binding.isMutate ? binding.mutateCallback :
    binding.isValidate ? binding.validateCallback :
    null;
};
export const definedCallbackName = pipe(definedCallback, defaultTo({ name: "" }), callback => callback.name);

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

export const uncarryableNamespace = allPass([
  pipe(nthArg(0), length, gt(__, 0)),
  pipe(nthArg(1), carriesNamespace),
  pipe((namespaceSelector, kubernetesObject) => namespaceSelector.includes(carriedNamespace(kubernetesObject)), not),
]);

export const missingCarriableNamespace = allPass([
  pipe(nthArg(0), length, gt(__, 0)),
  pipe((namespaceSelector: string[], kubernetesObject: KubernetesObject): boolean =>
    kubernetesObject.kind === "Namespace"
      ? !namespaceSelector.includes(kubernetesObject.metadata!.name!)
      : !carriesNamespace(kubernetesObject),
  ),
]);

export const carriesIgnoredNamespace = allPass([
  pipe(nthArg(0), length, gt(__, 0)),
  pipe(nthArg(1), carriesNamespace),
  pipe((namespaceSelector, kubernetesObject) => namespaceSelector.includes(carriedNamespace(kubernetesObject))),
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
