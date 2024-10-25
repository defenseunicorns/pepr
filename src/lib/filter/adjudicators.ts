// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Event, Operation } from "../types";
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

/*
  Naming scheme:
  - AdmissionRequest - "declares" / "neglects"
  - KubernetesObject - "carries" / "missing"
  - Binding - "defines" / "ignores"
*/

/*
  AdmissionRequest collectors
*/
export const declaredOperation = pipe(request => request?.operation, defaultTo(""));
export const declaredGroup = pipe(request => request?.kind?.group, defaultTo(""));
export const declaredVersion = pipe(request => request?.kind?.version, defaultTo(""));
export const declaredKind = pipe(request => request?.kind?.kind, defaultTo(""));
export const declaredUid = pipe(request => request?.uid, defaultTo(""));

/*
  KubernetesObject collectors
*/
export const carriesDeletionTimestamp = pipe(obj => !!obj.metadata?.deletionTimestamp, defaultTo(false));
export const missingDeletionTimestamp = complement(carriesDeletionTimestamp);

export const carriedName = pipe(obj => obj?.metadata?.name, defaultTo(""));
export const carriesName = pipe(carriedName, equals(""), not);
export const missingName = complement(carriesName);

export const carriedNamespace = pipe(obj => obj?.metadata?.namespace, defaultTo(""));
export const carriesNamespace = pipe(carriedNamespace, equals(""), not);

export const carriedAnnotations = pipe(obj => obj?.metadata?.annotations, defaultTo({}));
export const carriesAnnotations = pipe(carriedAnnotations, equals({}), not);

export const carriedLabels = pipe(obj => obj?.metadata?.labels, defaultTo({}));
export const carriesLabels = pipe(carriedLabels, equals({}), not);

/*
  Binding collectors
*/

//TODO: Defnined can go??
export const definesDeletionTimestamp = pipe(binding => binding?.filters?.deletionTimestamp, defaultTo(false));
export const ignoresDeletionTimestamp = complement(definesDeletionTimestamp);

export const definedName = pipe(binding => binding?.filters?.name, defaultTo(""));
export const definesName = pipe(definedName, equals(""), not);
export const ignoresName = complement(definesName);

export const definedNameRegex = pipe(binding => binding?.filters?.regexName, defaultTo(""));
export const definesNameRegex = pipe(definedNameRegex, equals(""), not);

export const definedNamespaces = pipe(binding => binding?.filters?.namespaces, defaultTo([]));
export const definesNamespaces = pipe(definedNamespaces, equals([]), not);

export const definedNamespaceRegexes = pipe(binding => binding?.filters?.regexNamespaces, defaultTo([]));
export const definesNamespaceRegexes = pipe(definedNamespaceRegexes, equals([]), not);

export const definedAnnotations = pipe(binding => binding?.filters?.annotations, defaultTo({}));
export const definesAnnotations = pipe(definedAnnotations, equals({}), not);

export const definedLabels = pipe(binding => binding?.filters?.labels, defaultTo({}));
export const definesLabels = pipe(definedLabels, equals({}), not);

export const definedEvent = pipe(binding => binding?.event, defaultTo(""));
export const definesDelete = pipe(definedEvent, equals(Operation.DELETE));

export const definedGroup = pipe(binding => binding?.kind?.group, defaultTo(""));
export const definesGroup = pipe(definedGroup, equals(""), not);

export const definedVersion = pipe(binding => binding?.kind?.version, defaultTo(""));
export const definesVersion = pipe(definedVersion, equals(""), not);

export const definedKind = pipe(binding => binding?.kind?.kind, defaultTo(""));
export const definesKind = pipe(definedKind, equals(""), not);

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

/*
  post-collection comparitors
*/
export const mismatchedDeletionTimestamp = allPass([
  pipe(nthArg(0), definesDeletionTimestamp),
  pipe(nthArg(1), missingDeletionTimestamp),
]);

export const mismatchedName = allPass([
  pipe(nthArg(0), definesName),
  pipe((bnd, obj) => definedName(bnd) !== carriedName(obj)),
]);

export const mismatchedNameRegex = allPass([
  pipe(nthArg(0), definesNameRegex),
  pipe((bnd, obj) => new RegExp(definedNameRegex(bnd)).test(carriedName(obj)), not),
]);

export const bindsToKind = curry(
  allPass([pipe(nthArg(0), definedKind, equals(""), not), pipe((bnd, knd) => definedKind(bnd) === knd)]),
);
export const bindsToNamespace = curry(pipe(bindsToKind(__, "Namespace")));
export const misboundNamespace = allPass([bindsToNamespace, definesNamespaces]);

export const mismatchedNamespace = allPass([
  pipe(nthArg(0), definesNamespaces),
  pipe((bnd, obj) => definedNamespaces(bnd).includes(carriedNamespace(obj)), not),
]);

export const mismatchedNamespaceRegex = allPass([
  pipe(nthArg(0), definesNamespaceRegexes),
  pipe((bnd, obj) =>
    pipe(
      any((rex: string) => new RegExp(rex).test(carriedNamespace(obj))),
      not,
    )(definedNamespaceRegexes(bnd)),
  ),
]);

export const metasMismatch = pipe(
  (defined, carried) => {
    const result = { defined, carried, unalike: {} };

    result.unalike = Object.entries(result.defined)
      .map(([key, val]) => {
        const keyMissing = !Object.hasOwn(result.carried, key);
        const noValue = !val;
        const valMissing = !result.carried[key];
        const valDiffers = result.carried[key] !== result.defined[key];

        // prettier-ignore
        return (
          keyMissing ? { [key]: val } :
          noValue ? {} :
          valMissing ? { [key]: val } :
          valDiffers ? { [key]: val } :
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
  pipe((bnd, obj) => metasMismatch(definedAnnotations(bnd), carriedAnnotations(obj))),
]);

export const mismatchedLabels = allPass([
  pipe(nthArg(0), definesLabels),
  pipe((bnd, obj) => metasMismatch(definedLabels(bnd), carriedLabels(obj))),
]);

export const uncarryableNamespace = allPass([
  pipe(nthArg(0), length, gt(__, 0)),
  pipe(nthArg(1), carriesNamespace),
  pipe((nss, obj) => nss.includes(carriedNamespace(obj)), not),
]);

export const carriesIgnoredNamespace = allPass([
  pipe(nthArg(0), length, gt(__, 0)),
  pipe(nthArg(1), carriesNamespace),
  pipe((nss, obj) => nss.includes(carriedNamespace(obj))),
]);

export const unbindableNamespaces = allPass([
  pipe(nthArg(0), length, gt(__, 0)),
  pipe(nthArg(1), definesNamespaces),
  pipe((nss, bnd) => difference(definedNamespaces(bnd), nss), length, equals(0), not),
]);

export const misboundDeleteWithDeletionTimestamp = allPass([definesDelete, definesDeletionTimestamp]);

export const operationMatchesEvent = anyPass([
  pipe(nthArg(1), equals(Event.Any)),
  pipe((op, evt) => op === evt),
  pipe((op, evt) => (op ? evt.includes(op) : false)),
]);

export const mismatchedEvent = pipe(
  (binding, request) => operationMatchesEvent(declaredOperation(request), definedEvent(binding)),
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
