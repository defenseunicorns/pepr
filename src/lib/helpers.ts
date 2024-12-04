// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { KubernetesObject } from "kubernetes-fluent-client";
import Log from "./logger";
import { Binding, CapabilityExport } from "./types";
import { sanitizeResourceName } from "../sdk/sdk";
import {
  carriedAnnotations,
  carriedLabels,
  carriedName,
  carriedNamespace,
  carriesIgnoredNamespace,
  definedAnnotations,
  definedLabels,
  definedName,
  definedNameRegex,
  definedNamespaces,
  definedNamespaceRegexes,
  misboundNamespace,
  mismatchedAnnotations,
  mismatchedDeletionTimestamp,
  mismatchedLabels,
  mismatchedName,
  mismatchedNameRegex,
  mismatchedNamespace,
  mismatchedNamespaceRegex,
  missingCarriableNamespace,
  unbindableNamespaces,
  uncarryableNamespace,
} from "./filter/adjudicators";

export function matchesRegex(pattern: string, testString: string): boolean {
  return new RegExp(pattern).test(testString);
}

export class ValidationError extends Error {}

export function validateCapabilityNames(capabilities: CapabilityExport[] | undefined): void {
  if (capabilities && capabilities.length > 0) {
    for (let i = 0; i < capabilities.length; i++) {
      if (capabilities[i].name !== sanitizeResourceName(capabilities[i].name)) {
        throw new ValidationError(`Capability name is not a valid Kubernetes resource name: ${capabilities[i].name}`);
      }
    }
  }
}

export function validateHash(expectedHash: string): void {
  // Require the hash to be a valid SHA-256 hash (64 characters, hexadecimal)
  const sha256Regex = /^[a-f0-9]{64}$/i;
  if (!expectedHash || !sha256Regex.test(expectedHash)) {
    Log.error(`Invalid hash. Expected a valid SHA-256 hash, got ${expectedHash}`);
    throw new ValidationError("Invalid hash");
  }
}

export type RBACMap = {
  [key: string]: {
    verbs: string[];
    plural: string;
  };
};

/**
 * Decide to run callback after the event comes back from API Server
 **/
export function filterNoMatchReason(
  binding: Binding,
  object: Partial<KubernetesObject>,
  capabilityNamespaces: string[],
  ignoredNamespaces?: string[],
): string {
  const prefix = "Ignoring Watch Callback:";

  // prettier-ignore
  return (
    mismatchedDeletionTimestamp(binding, object) ?
      `${prefix} Binding defines deletionTimestamp but Object does not carry it.` :

    mismatchedName(binding, object) ?
      `${prefix} Binding defines name '${definedName(binding)}' but Object carries '${carriedName(object)}'.` :

    misboundNamespace(binding) ?
      `${prefix} Cannot use namespace filter on a namespace object.` :

    mismatchedLabels(binding, object) ?
      (
        `${prefix} Binding defines labels '${JSON.stringify(definedLabels(binding))}' ` +
        `but Object carries '${JSON.stringify(carriedLabels(object))}'.`
      ) :

    mismatchedAnnotations(binding, object) ?
      (
        `${prefix} Binding defines annotations '${JSON.stringify(definedAnnotations(binding))}' ` +
        `but Object carries '${JSON.stringify(carriedAnnotations(object))}'.`
      ) :

    uncarryableNamespace(capabilityNamespaces, object) ?
      (
        `${prefix} Object carries namespace '${carriedNamespace(object)}' ` +
        `but namespaces allowed by Capability are '${JSON.stringify(capabilityNamespaces)}'.`
      ) :

    unbindableNamespaces(capabilityNamespaces, binding) ?
      (
        `${prefix} Binding defines namespaces ${JSON.stringify(definedNamespaces(binding))} ` +
        `but namespaces allowed by Capability are '${JSON.stringify(capabilityNamespaces)}'.`
      ) :

    mismatchedNamespace(binding, object) ?
      (
        `${prefix} Binding defines namespaces '${JSON.stringify(definedNamespaces(binding))}' ` +
        `but Object carries '${carriedNamespace(object)}'.`
      ) :

    mismatchedNamespaceRegex(binding, object) ?
      (
        `${prefix} Binding defines namespace regexes ` +
        `'${JSON.stringify(definedNamespaceRegexes(binding))}' ` +
        `but Object carries '${carriedNamespace(object)}'.`
      ) :

    mismatchedNameRegex(binding, object) ?
      (
        `${prefix} Binding defines name regex '${definedNameRegex(binding)}' ` +
        `but Object carries '${carriedName(object)}'.`
      ) :

    carriesIgnoredNamespace(ignoredNamespaces, object) ?
      (
        `${prefix} Object carries namespace '${carriedNamespace(object)}' ` +
        `but ignored namespaces include '${JSON.stringify(ignoredNamespaces)}'.`
      ) :

    missingCarriableNamespace(capabilityNamespaces, object) ? 
      (
        `${prefix} Object does not carry a namespace ` +
        `but namespaces allowed by Capability are '${JSON.stringify(capabilityNamespaces)}'.`
      ) :

    ""
  );
}

export function addVerbIfNotExists(verbs: string[], verb: string) {
  if (!verbs.includes(verb)) {
    verbs.push(verb);
  }
}

export function createRBACMap(capabilities: CapabilityExport[]): RBACMap {
  return capabilities.reduce((acc: RBACMap, capability: CapabilityExport) => {
    capability.bindings.forEach(binding => {
      const key = `${binding.kind.group}/${binding.kind.version}/${binding.kind.kind}`;

      acc["pepr.dev/v1/peprstore"] = {
        verbs: ["create", "get", "patch", "watch"],
        plural: "peprstores",
      };

      acc["apiextensions.k8s.io/v1/customresourcedefinition"] = {
        verbs: ["patch", "create"],
        plural: "customresourcedefinitions",
      };

      if (!acc[key] && binding.isWatch) {
        acc[key] = {
          verbs: ["watch"],
          plural: binding.kind.plural || `${binding.kind.kind.toLowerCase()}s`,
        };
      }

      // Add finalizer rbac
      if (binding.isFinalize) {
        acc[key] = {
          verbs: ["patch"],
          plural: binding.kind.plural || `${binding.kind.kind.toLowerCase()}s`,
        };
      }
    });

    return acc;
  }, {});
}

export function hasEveryOverlap<T>(array1: T[], array2: T[]): boolean {
  if (!Array.isArray(array1) || !Array.isArray(array2)) {
    return false;
  }

  return array1.every(element => array2.includes(element));
}

export function hasAnyOverlap<T>(array1: T[], array2: T[]): boolean {
  if (!Array.isArray(array1) || !Array.isArray(array2)) {
    return false;
  }

  return array1.some(element => array2.includes(element));
}

export function ignoredNamespaceConflict(ignoreNamespaces: string[], bindingNamespaces: string[]) {
  return hasAnyOverlap(bindingNamespaces, ignoreNamespaces);
}

export function bindingAndCapabilityNSConflict(bindingNamespaces: string[], capabilityNamespaces: string[]) {
  if (!capabilityNamespaces) {
    return false;
  }
  return capabilityNamespaces.length !== 0 && !hasEveryOverlap(bindingNamespaces, capabilityNamespaces);
}

export function generateWatchNamespaceError(
  ignoredNamespaces: string[],
  bindingNamespaces: string[],
  capabilityNamespaces: string[],
) {
  let err = "";

  // check if binding uses an ignored namespace
  if (ignoredNamespaceConflict(ignoredNamespaces, bindingNamespaces)) {
    err += `Binding uses a Pepr ignored namespace: ignoredNamespaces: [${ignoredNamespaces.join(
      ", ",
    )}] bindingNamespaces: [${bindingNamespaces.join(", ")}].`;
  }

  // ensure filter namespaces are part of capability namespaces
  if (bindingAndCapabilityNSConflict(bindingNamespaces, capabilityNamespaces)) {
    err += `Binding uses namespace not governed by capability: bindingNamespaces: [${bindingNamespaces.join(
      ", ",
    )}] capabilityNamespaces: [${capabilityNamespaces.join(", ")}].`;
  }

  // add a space if there is a period in the middle of the string
  return err.replace(/\.([^ ])/g, ". $1");
}

// namespaceComplianceValidator ensures that capability bindings respect ignored and capability namespaces
export function namespaceComplianceValidator(capability: CapabilityExport, ignoredNamespaces?: string[]) {
  const { namespaces: capabilityNamespaces, bindings, name } = capability;
  const bindingNamespaces: string[] = bindings.flatMap((binding: Binding) => binding.filters.namespaces);
  const bindingRegexNamespaces: string[] = bindings.flatMap(
    (binding: Binding) => binding.filters.regexNamespaces || [],
  );

  const namespaceError = generateWatchNamespaceError(
    ignoredNamespaces ? ignoredNamespaces : [],
    bindingNamespaces,
    capabilityNamespaces ? capabilityNamespaces : [],
  );
  if (namespaceError !== "") {
    throw new Error(
      `Error in ${name} capability. A binding violates namespace rules. Please check ignoredNamespaces and capability namespaces: ${namespaceError}`,
    );
  }

  // Ensure that each regexNamespace matches a capabilityNamespace

  if (
    bindingRegexNamespaces &&
    bindingRegexNamespaces.length > 0 &&
    capabilityNamespaces &&
    capabilityNamespaces.length > 0
  ) {
    for (const regexNamespace of bindingRegexNamespaces) {
      let matches = false;
      matches =
        regexNamespace !== "" &&
        capabilityNamespaces.some(capabilityNamespace => matchesRegex(regexNamespace, capabilityNamespace));
      if (!matches) {
        throw new Error(
          `Ignoring Watch Callback: Object namespace does not match any capability namespace with regex ${regexNamespace}.`,
        );
      }
    }
  }
  // ensure regexNamespaces do not match ignored ns
  if (
    bindingRegexNamespaces &&
    bindingRegexNamespaces.length > 0 &&
    ignoredNamespaces &&
    ignoredNamespaces.length > 0
  ) {
    for (const regexNamespace of bindingRegexNamespaces) {
      const matchedNS = ignoredNamespaces.find(ignoredNS => matchesRegex(regexNamespace, ignoredNS));
      if (matchedNS) {
        throw new Error(
          `Ignoring Watch Callback: Regex namespace: ${regexNamespace}, is an ignored namespace: ${matchedNS}.`,
        );
      }
    }
  }
}

// check if secret is over the size limit
export function secretOverLimit(str: string): boolean {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(str);
  const sizeInBytes = encoded.length;
  const oneMiBInBytes = 1048576;
  return sizeInBytes > oneMiBInBytes;
}

/* eslint-disable @typescript-eslint/no-unused-vars */
export const parseTimeout = (value: string, previous: unknown): number => {
  const parsedValue = parseInt(value, 10);
  const floatValue = parseFloat(value);
  if (isNaN(parsedValue)) {
    throw new Error("Not a number.");
  } else if (parsedValue !== floatValue) {
    throw new Error("Value must be an integer.");
  } else if (parsedValue < 1 || parsedValue > 30) {
    throw new Error("Number must be between 1 and 30.");
  }
  return parsedValue;
};

// Remove leading whitespace while keeping format of file
export function dedent(file: string): string {
  // Check if the first line is empty and remove it
  const lines = file.split("\n");
  if (lines[0].trim() === "") {
    lines.shift(); // Remove the first line if it's empty
    file = lines.join("\n"); // Rejoin the remaining lines back into a single string
  }

  const match = file.match(/^[ \t]*(?=\S)/gm);
  const indent = match && Math.min(...match.map(el => el.length));
  if (indent && indent > 0) {
    const re = new RegExp(`^[ \\t]{${indent}}`, "gm");
    return file.replace(re, "");
  }
  return file;
}

export function replaceString(str: string, stringA: string, stringB: string): string {
  // eslint-disable-next-line no-useless-escape
  const escapedStringA = stringA.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  const regExp = new RegExp(escapedStringA, "g");
  return str.replace(regExp, stringB);
}
