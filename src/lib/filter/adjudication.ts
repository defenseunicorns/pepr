import { KubernetesObject } from "kubernetes-fluent-client";
import { AdmissionRequest } from "../common-types";
import { Binding } from "../types";
import {
  declaredOperation,
  declaredGroup,
  declaredVersion,
  declaredKind,
} from "./adjudicators/admissionRequest";
import {
  definedEvent,
  definedName,
  definedGroup,
  definedVersion,
  definedKind,
  definedNamespaces,
  definedLabels,
  definedAnnotations,
  definedNamespaceRegexes,
  definedNameRegex,
} from "./adjudicators/binding";
import {
  carriedName,
  carriedNamespace,
  carriedLabels,
  carriedAnnotations,
} from "./adjudicators/kubernetesObject";
import {
  mismatchedDeletionTimestamp,
  mismatchedEvent,
  mismatchedName,
  mismatchedGroup,
  mismatchedVersion,
  mismatchedKind,
  mismatchedNamespace,
  mismatchedLabels,
  mismatchedAnnotations,
  mismatchedNamespaceRegex,
  mismatchedNameRegex,
} from "./adjudicators/mismatch";
import {
  misboundNamespace,
  misboundDeleteWithDeletionTimestamp,
  unbindableNamespaces,
  uncarryableNamespace,
  carriesIgnoredNamespace,
  missingCarriableNamespace,
} from "./adjudicators/postCollection";
import { AdjudicationResult } from "../types";

export function adjudicateMisboundNamespace(binding: Binding): AdjudicationResult {
  return misboundNamespace(binding) ? "Cannot use namespace filter on a namespace object." : null;
}

export function adjudicateMisboundDeleteWithDeletionTimestamp(
  binding: Binding,
): AdjudicationResult {
  return misboundDeleteWithDeletionTimestamp(binding)
    ? "Cannot use deletionTimestamp filter on a DELETE operation."
    : null;
}

export function adjudicateMismatchedDeletionTimestamp(
  binding: Binding,
  obj: KubernetesObject,
): AdjudicationResult {
  return mismatchedDeletionTimestamp(binding, obj)
    ? "Binding defines deletionTimestamp but Object does not carry it."
    : null;
}

export function adjudicateMismatchedEvent(
  binding: Binding,
  req: AdmissionRequest,
): AdjudicationResult {
  return mismatchedEvent(binding, req)
    ? `Binding defines event '${definedEvent(binding)}' but Request declares '${declaredOperation(req)}'.`
    : null;
}

export function adjudicateMismatchedName(
  binding: Binding,
  obj: KubernetesObject,
): AdjudicationResult {
  return mismatchedName(binding, obj)
    ? `Binding defines name '${definedName(binding)}' but Object carries '${carriedName(obj)}'.`
    : null;
}

export function adjudicateMismatchedGroup(
  binding: Binding,
  req: AdmissionRequest,
): AdjudicationResult {
  return mismatchedGroup(binding, req)
    ? `Binding defines group '${definedGroup(binding)}' but Request declares '${declaredGroup(req)}'.`
    : null;
}

export function adjudicateMismatchedVersion(
  binding: Binding,
  req: AdmissionRequest,
): AdjudicationResult {
  return mismatchedVersion(binding, req)
    ? `Binding defines version '${definedVersion(binding)}' but Request declares '${declaredVersion(req)}'.`
    : null;
}

export function adjudicateMismatchedKind(
  binding: Binding,
  req: AdmissionRequest,
): AdjudicationResult {
  return mismatchedKind(binding, req)
    ? `Binding defines kind '${definedKind(binding)}' but Request declares '${declaredKind(req)}'.`
    : null;
}

export function adjudicateUnbindableNamespaces(
  capabilityNamespaces: string[],
  binding: Binding,
): AdjudicationResult {
  return unbindableNamespaces(capabilityNamespaces, binding)
    ? `Binding defines namespaces ${JSON.stringify(definedNamespaces(binding))} but namespaces allowed by Capability are '${JSON.stringify(capabilityNamespaces)}'.`
    : null;
}

export function adjudicateUncarryableNamespace(
  capabilityNamespaces: string[],
  obj: KubernetesObject,
): AdjudicationResult {
  return uncarryableNamespace(capabilityNamespaces, obj)
    ? `Object carries namespace '${obj.kind && obj.kind === "Namespace" ? obj.metadata?.name : carriedNamespace(obj)}' but namespaces allowed by Capability are '${JSON.stringify(capabilityNamespaces)}'.`
    : null;
}

export function adjudicateMismatchedNamespace(
  binding: Binding,
  obj: KubernetesObject,
): AdjudicationResult {
  return mismatchedNamespace(binding, obj)
    ? `Binding defines namespaces '${JSON.stringify(definedNamespaces(binding))}' but Object carries '${carriedNamespace(obj)}'.`
    : null;
}

export function adjudicateMismatchedLabels(
  binding: Binding,
  obj: KubernetesObject,
): AdjudicationResult {
  return mismatchedLabels(binding, obj)
    ? `Binding defines labels '${JSON.stringify(definedLabels(binding))}' but Object carries '${JSON.stringify(carriedLabels(obj))}'.`
    : null;
}

export function adjudicateMismatchedAnnotations(
  binding: Binding,
  obj: KubernetesObject,
): AdjudicationResult {
  return mismatchedAnnotations(binding, obj)
    ? `Binding defines annotations '${JSON.stringify(definedAnnotations(binding))}' but Object carries '${JSON.stringify(carriedAnnotations(obj))}'.`
    : null;
}

export function adjudicateMismatchedNamespaceRegex(
  binding: Binding,
  obj: KubernetesObject,
): AdjudicationResult {
  return mismatchedNamespaceRegex(binding, obj)
    ? `Binding defines namespace regexes '${JSON.stringify(definedNamespaceRegexes(binding))}' but Object carries '${carriedNamespace(obj)}'.`
    : null;
}

export function adjudicateMismatchedNameRegex(
  binding: Binding,
  obj: KubernetesObject,
): AdjudicationResult {
  return mismatchedNameRegex(binding, obj)
    ? `Binding defines name regex '${definedNameRegex(binding)}' but Object carries '${carriedName(obj)}'.`
    : null;
}

export function adjudicateCarriesIgnoredNamespace(
  ignoredNamespaces: string[] | undefined,
  obj: KubernetesObject,
): AdjudicationResult {
  return carriesIgnoredNamespace(ignoredNamespaces, obj)
    ? `Object carries namespace '${obj.kind && obj.kind === "Namespace" ? obj.metadata?.name : carriedNamespace(obj)}' but ignored namespaces include '${JSON.stringify(ignoredNamespaces)}'.`
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
