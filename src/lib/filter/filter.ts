// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { AdmissionRequest, Binding } from "../types";
import { Operation } from "../enums";
import { KubernetesObject } from "kubernetes-fluent-client";
import {
  carriesIgnoredNamespace,
  carriedName,
  definedEvent,
  declaredOperation,
  definedName,
  definedGroup,
  declaredGroup,
  definedVersion,
  declaredVersion,
  definedKind,
  declaredKind,
  definedNamespaces,
  carriedNamespace,
  definedLabels,
  carriedLabels,
  definedAnnotations,
  carriedAnnotations,
  definedNamespaceRegexes,
  definedNameRegex,
  misboundDeleteWithDeletionTimestamp,
  mismatchedDeletionTimestamp,
  mismatchedAnnotations,
  mismatchedLabels,
  mismatchedName,
  mismatchedNameRegex,
  mismatchedNamespace,
  mismatchedNamespaceRegex,
  mismatchedEvent,
  mismatchedGroup,
  mismatchedVersion,
  mismatchedKind,
  missingCarriableNamespace,
  unbindableNamespaces,
  uncarryableNamespace,
} from "./adjudicators/adjudicators";

type AdjudicationResult = string | null;
/**
 * shouldSkipRequest determines if a request should be skipped based on the binding filters.
 *
 * @param binding the action binding
 * @param req the incoming request
 * @returns
 */
export function shouldSkipRequest(
  binding: Binding,
  req: AdmissionRequest,
  capabilityNamespaces: string[],
  ignoredNamespaces?: string[],
): string {
  const obj = (req.operation === Operation.DELETE ? req.oldObject : req.object)!;
  const prefix = "Ignoring Admission Callback:";

  const adjudicators: Array<() => AdjudicationResult> = [
    (): AdjudicationResult => adjudicateMisboundDeleteWithDeletionTimestamp(binding),
    (): AdjudicationResult => adjudicateMismatchedDeletionTimestamp(binding, obj),
    (): AdjudicationResult => adjudicateMismatchedEvent(binding, req),
    (): AdjudicationResult => adjudicateMismatchedName(binding, obj),
    (): AdjudicationResult => adjudicateMismatchedGroup(binding, req),
    (): AdjudicationResult => adjudicateMismatchedVersion(binding, req),
    (): AdjudicationResult => adjudicateMismatchedKind(binding, req),
    (): AdjudicationResult => adjudicateUnbindableNamespaces(capabilityNamespaces, binding),
    (): AdjudicationResult => adjudicateUncarryableNamespace(capabilityNamespaces, obj),
    (): AdjudicationResult => adjudicateMismatchedNamespace(binding, obj),
    (): AdjudicationResult => adjudicateMismatchedLabels(binding, obj),
    (): AdjudicationResult => adjudicateMismatchedAnnotations(binding, obj),
    (): AdjudicationResult => adjudicateMismatchedNamespaceRegex(binding, obj),
    (): AdjudicationResult => adjudicateMismatchedNameRegex(binding, obj),
    (): AdjudicationResult => adjudicateCarriesIgnoredNamespace(ignoredNamespaces, obj),
    (): AdjudicationResult => adjudicateMissingCarriableNamespace(capabilityNamespaces, obj),
  ];

  for (const adjudicator of adjudicators) {
    const result = adjudicator();
    if (result) {
      return `${prefix} ${result}`;
    }
  }

  return "";
}

export function adjudicateMisboundDeleteWithDeletionTimestamp(binding: Binding): AdjudicationResult {
  return misboundDeleteWithDeletionTimestamp(binding)
    ? "Cannot use deletionTimestamp filter on a DELETE operation."
    : null;
}

export function adjudicateMismatchedDeletionTimestamp(binding: Binding, obj: KubernetesObject): AdjudicationResult {
  return mismatchedDeletionTimestamp(binding, obj)
    ? "Binding defines deletionTimestamp but Object does not carry it."
    : null;
}

export function adjudicateMismatchedEvent(binding: Binding, req: AdmissionRequest): AdjudicationResult {
  return mismatchedEvent(binding, req)
    ? `Binding defines event '${definedEvent(binding)}' but Request declares '${declaredOperation(req)}'.`
    : null;
}

export function adjudicateMismatchedName(binding: Binding, obj: KubernetesObject): AdjudicationResult {
  return mismatchedName(binding, obj)
    ? `Binding defines name '${definedName(binding)}' but Object carries '${carriedName(obj)}'.`
    : null;
}

export function adjudicateMismatchedGroup(binding: Binding, req: AdmissionRequest): AdjudicationResult {
  return mismatchedGroup(binding, req)
    ? `Binding defines group '${definedGroup(binding)}' but Request declares '${declaredGroup(req)}'.`
    : null;
}

export function adjudicateMismatchedVersion(binding: Binding, req: AdmissionRequest): AdjudicationResult {
  return mismatchedVersion(binding, req)
    ? `Binding defines version '${definedVersion(binding)}' but Request declares '${declaredVersion(req)}'.`
    : null;
}

export function adjudicateMismatchedKind(binding: Binding, req: AdmissionRequest): AdjudicationResult {
  return mismatchedKind(binding, req)
    ? `Binding defines kind '${definedKind(binding)}' but Request declares '${declaredKind(req)}'.`
    : null;
}

export function adjudicateUnbindableNamespaces(capabilityNamespaces: string[], binding: Binding): AdjudicationResult {
  return unbindableNamespaces(capabilityNamespaces, binding)
    ? `Binding defines namespaces ${JSON.stringify(definedNamespaces(binding))} but namespaces allowed by Capability are '${JSON.stringify(capabilityNamespaces)}'.`
    : null;
}

export function adjudicateUncarryableNamespace(
  capabilityNamespaces: string[],
  obj: KubernetesObject,
): AdjudicationResult {
  return uncarryableNamespace(capabilityNamespaces, obj)
    ? `Object carries namespace '${carriedNamespace(obj)}' but namespaces allowed by Capability are '${JSON.stringify(capabilityNamespaces)}'.`
    : null;
}

export function adjudicateMismatchedNamespace(binding: Binding, obj: KubernetesObject): AdjudicationResult {
  return mismatchedNamespace(binding, obj)
    ? `Binding defines namespaces '${JSON.stringify(definedNamespaces(binding))}' but Object carries '${carriedNamespace(obj)}'.`
    : null;
}

export function adjudicateMismatchedLabels(binding: Binding, obj: KubernetesObject): AdjudicationResult {
  return mismatchedLabels(binding, obj)
    ? `Binding defines labels '${JSON.stringify(definedLabels(binding))}' but Object carries '${JSON.stringify(carriedLabels(obj))}'.`
    : null;
}

export function adjudicateMismatchedAnnotations(binding: Binding, obj: KubernetesObject): AdjudicationResult {
  return mismatchedAnnotations(binding, obj)
    ? `Binding defines annotations '${JSON.stringify(definedAnnotations(binding))}' but Object carries '${JSON.stringify(carriedAnnotations(obj))}'.`
    : null;
}

export function adjudicateMismatchedNamespaceRegex(binding: Binding, obj: KubernetesObject): AdjudicationResult {
  return mismatchedNamespaceRegex(binding, obj)
    ? `Binding defines namespace regexes '${JSON.stringify(definedNamespaceRegexes(binding))}' but Object carries '${carriedNamespace(obj)}'.`
    : null;
}

export function adjudicateMismatchedNameRegex(binding: Binding, obj: KubernetesObject): AdjudicationResult {
  return mismatchedNameRegex(binding, obj)
    ? `Binding defines name regex '${definedNameRegex(binding)}' but Object carries '${carriedName(obj)}'.`
    : null;
}

export function adjudicateCarriesIgnoredNamespace(
  ignoredNamespaces: string[] | undefined,
  obj: KubernetesObject,
): AdjudicationResult {
  return carriesIgnoredNamespace(ignoredNamespaces, obj)
    ? `Object carries namespace '${carriedNamespace(obj)}' but ignored namespaces include '${JSON.stringify(ignoredNamespaces)}'.`
    : null;
}

export function adjudicateMissingCarriableNamespace(
  capabilityNamespaces: string[],
  obj: KubernetesObject,
): AdjudicationResult {
  return missingCarriableNamespace(capabilityNamespaces, obj)
    ? `Object does not carry a namespace but namespaces allowed by Capability are '${JSON.stringify(capabilityNamespaces)}'.`
    : null;
}
