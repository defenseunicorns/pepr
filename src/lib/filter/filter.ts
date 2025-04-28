// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { AdjudicationResult, Binding } from "../types";
import { Operation } from "../enums";
import { KubernetesObject } from "kubernetes-fluent-client";
import { AdmissionRequest } from "../common-types";
import {
  adjudicateMisboundDeleteWithDeletionTimestamp,
  adjudicateMismatchedDeletionTimestamp,
  adjudicateMismatchedEvent,
  adjudicateMismatchedName,
  adjudicateMismatchedGroup,
  adjudicateMismatchedVersion,
  adjudicateMismatchedKind,
  adjudicateUnbindableNamespaces,
  adjudicateUncarryableNamespace,
  adjudicateMismatchedNamespace,
  adjudicateMismatchedLabels,
  adjudicateMismatchedAnnotations,
  adjudicateMismatchedNamespaceRegex,
  adjudicateMismatchedNameRegex,
  adjudicateCarriesIgnoredNamespace,
  adjudicateMissingCarriableNamespace,
  adjudicateMisboundNamespace,
} from "./adjudication";

type Adjudicator = () => AdjudicationResult;

/**
 * shouldSkipRequest determines if an admission request should be skipped based on the binding filters.
 *
 * @param binding the action binding
 * @param req the incoming request
 * @param capabilityNamespaces the namespaces allowed by capability
 * @param ignoredNamespaces the namespaces ignored by module config
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

  const adjudicators: Adjudicator[] = [
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

/**
 * filterNoMatchReason determines whether a callback should be skipped after
 *  receiving an update event from the API server, based on the binding filters.
 *
 * @param binding the action binding
 * @param kubernetesObject the incoming kubernetes object
 * @param capabilityNamespaces the namespaces allowed by capability
 * @param ignoredNamespaces the namespaces ignored by module config
 */
export function filterNoMatchReason(
  binding: Binding,
  obj: Partial<KubernetesObject>,
  capabilityNamespaces: string[],
  ignoredNamespaces?: string[],
): string {
  const prefix = "Ignoring Watch Callback:";

  const adjudicators: Adjudicator[] = [
    (): AdjudicationResult => adjudicateMismatchedDeletionTimestamp(binding, obj),
    (): AdjudicationResult => adjudicateMismatchedName(binding, obj),
    (): AdjudicationResult => adjudicateMisboundNamespace(binding),
    (): AdjudicationResult => adjudicateMismatchedLabels(binding, obj),
    (): AdjudicationResult => adjudicateMismatchedAnnotations(binding, obj),
    (): AdjudicationResult => adjudicateUncarryableNamespace(capabilityNamespaces, obj),
    (): AdjudicationResult => adjudicateUnbindableNamespaces(capabilityNamespaces, binding),
    (): AdjudicationResult => adjudicateMismatchedNamespace(binding, obj),
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
