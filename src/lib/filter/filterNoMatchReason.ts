import { KubernetesObject } from "kubernetes-fluent-client";
import {
  mismatchedDeletionTimestamp,
  mismatchedName,
  definedName,
  carriedName,
  misboundNamespace,
  mismatchedLabels,
  definedLabels,
  carriedLabels,
  mismatchedAnnotations,
  definedAnnotations,
  carriedAnnotations,
  uncarryableNamespace,
  carriedNamespace,
  unbindableNamespaces,
  definedNamespaces,
  mismatchedNamespace,
  mismatchedNamespaceRegex,
  definedNamespaceRegexes,
  mismatchedNameRegex,
  definedNameRegex,
  carriesIgnoredNamespace,
  missingCarriableNamespace,
} from "./adjudicators/adjudicators";
import { Binding } from "../types";

/**
 * Decide to run callback after the event comes back from API Server
 **/

export function filterNoMatchReason(
  binding: Binding,
  kubernetesObject: Partial<KubernetesObject>,
  capabilityNamespaces: string[],
  ignoredNamespaces?: string[],
): string {
  const prefix = "Ignoring Watch Callback:";

  // prettier-ignore
  return (
    mismatchedDeletionTimestamp(binding, kubernetesObject) ?
      `${prefix} Binding defines deletionTimestamp but Object does not carry it.` :

      mismatchedName(binding, kubernetesObject) ?
        `${prefix} Binding defines name '${definedName(binding)}' but Object carries '${carriedName(kubernetesObject)}'.` :

        misboundNamespace(binding) ?
          `${prefix} Cannot use namespace filter on a namespace object.` :

          mismatchedLabels(binding, kubernetesObject) ?
            (
              `${prefix} Binding defines labels '${JSON.stringify(definedLabels(binding))}' ` +
              `but Object carries '${JSON.stringify(carriedLabels(kubernetesObject))}'.`
            ) :

            mismatchedAnnotations(binding, kubernetesObject) ?
              (
                `${prefix} Binding defines annotations '${JSON.stringify(definedAnnotations(binding))}' ` +
                `but Object carries '${JSON.stringify(carriedAnnotations(kubernetesObject))}'.`
              ) :

              uncarryableNamespace(capabilityNamespaces, kubernetesObject) ?
                (
                  `${prefix} Object carries namespace '${carriedNamespace(kubernetesObject)}' ` +
                  `but namespaces allowed by Capability are '${JSON.stringify(capabilityNamespaces)}'.`
                ) :

                unbindableNamespaces(capabilityNamespaces, binding) ?
                  (
                    `${prefix} Binding defines namespaces ${JSON.stringify(definedNamespaces(binding))} ` +
                    `but namespaces allowed by Capability are '${JSON.stringify(capabilityNamespaces)}'.`
                  ) :

                  mismatchedNamespace(binding, kubernetesObject) ?
                    (
                      `${prefix} Binding defines namespaces '${JSON.stringify(definedNamespaces(binding))}' ` +
                      `but Object carries '${carriedNamespace(kubernetesObject)}'.`
                    ) :

                    mismatchedNamespaceRegex(binding, kubernetesObject) ?
                      (
                        `${prefix} Binding defines namespace regexes ` +
                        `'${JSON.stringify(definedNamespaceRegexes(binding))}' ` +
                        `but Object carries '${carriedNamespace(kubernetesObject)}'.`
                      ) :

                      mismatchedNameRegex(binding, kubernetesObject) ?
                        (
                          `${prefix} Binding defines name regex '${definedNameRegex(binding)}' ` +
                          `but Object carries '${carriedName(kubernetesObject)}'.`
                        ) :

                        carriesIgnoredNamespace(ignoredNamespaces, kubernetesObject) ?
                          (
                            `${prefix} Object carries namespace '${carriedNamespace(kubernetesObject)}' ` +
                            `but ignored namespaces include '${JSON.stringify(ignoredNamespaces)}'.`
                          ) :

                          missingCarriableNamespace(capabilityNamespaces, kubernetesObject) ?
                            (
                              `${prefix} Object does not carry a namespace ` +
                              `but namespaces allowed by Capability are '${JSON.stringify(capabilityNamespaces)}'.`
                            ) :

                            ""
  );
}
