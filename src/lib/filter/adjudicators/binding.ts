// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Event } from "../../enums";
import { Binding, FinalizeAction, WatchLogAction, MutateAction, ValidateAction } from "../../types";
import { complement, defaultTo, equals, not, pipe } from "ramda";
import { GenericClass } from "kubernetes-fluent-client";

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

export const definedNamespaceRegexes = pipe(
  binding => binding?.filters?.regexNamespaces,
  defaultTo([]),
);
export const definesNamespaceRegexes = pipe(definedNamespaceRegexes, equals([]), not);

export const definedAnnotations = pipe(
  (binding: Partial<Binding>) => binding?.filters?.annotations,
  defaultTo({}),
);
export const definesAnnotations = pipe(definedAnnotations, equals({}), not);

export const definedLabels = pipe(
  (binding: Partial<Binding>) => binding?.filters?.labels,
  defaultTo({}),
);
export const definesLabels = pipe(definedLabels, equals({}), not);

export const definedEvent = (binding: Binding): Event => {
  return binding.event;
};

export const definesDelete = pipe(definedEvent, equals<Event>(Event.DELETE));

export const definedGroup = pipe((binding): string => binding?.kind?.group, defaultTo(""));
export const definesGroup = pipe(definedGroup, equals(""), not);

export const definedVersion = pipe(
  (binding: Partial<Binding>): string | undefined => binding?.kind?.version,
  defaultTo(""),
);
export const definesVersion = pipe(definedVersion, equals(""), not);

export const definedKind = pipe((binding): string => binding?.kind?.kind, defaultTo(""));
export const definesKind = pipe(definedKind, equals(""), not);

export const definedCategory = (binding: Partial<Binding>): string => {
  // Ordering matters, finalize is a "watch"
  const categories: { [key: string]: boolean | undefined } = {
    Finalize: binding.isFinalize,
    Watch: binding.isWatch,
    Mutate: binding.isMutate,
    Validate: binding.isValidate,
  };

  return Object.keys(categories).find(key => categories[key]) || "";
};

type DefinedCallbackReturnType =
  | FinalizeAction<GenericClass, InstanceType<GenericClass>>
  | WatchLogAction<GenericClass, InstanceType<GenericClass>>
  | MutateAction<GenericClass, InstanceType<GenericClass>>
  | ValidateAction<GenericClass, InstanceType<GenericClass>>
  | null
  | undefined;

export const definedCallback = (binding: Partial<Binding>): DefinedCallbackReturnType => {
  // Ordering matters, finalize is a "watch"
  // prettier-ignore
  return binding.isFinalize ? binding.finalizeCallback :
    binding.isWatch ? binding.watchCallback :
    binding.isMutate ? binding.mutateCallback :
    binding.isValidate ? binding.validateCallback :
    null;
};
export const definedCallbackName = pipe(
  definedCallback,
  defaultTo({ name: "" }),
  callback => callback.name,
);
