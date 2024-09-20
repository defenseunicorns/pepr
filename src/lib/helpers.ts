// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { promises as fs } from "fs";
import { K8s, KubernetesObject, kind } from "kubernetes-fluent-client";
import Log from "./logger";
import { AdmissionRequest, Binding, CapabilityExport } from "./types";
import { sanitizeResourceName } from "../sdk/sdk";
import { __, allPass, complement, curry, defaultTo, difference, equals, gt, length, not, nthArg, pipe } from "ramda";

export function ignoredNSObjectViolation(
  req: Partial<AdmissionRequest> = {},
  obj: Partial<KubernetesObject> = {},
  ignoredNamespaces?: string[],
): boolean | string {
  if (!ignoredNamespaces || ignoredNamespaces.length === 0) {
    if (req && req.uid) {
      return false;
    } else {
      return "";
    }
  }
  // check if admission request is in ignored namespace
  if (req && req.uid && ignoredNamespaces.length > 0) {
    const operation = req.operation?.toUpperCase() || undefined;
    for (const ignoredNS of ignoredNamespaces) {
      if (operation && operation === "DELETE" && req.oldObject?.metadata?.namespace === ignoredNS) {
        return true;
      }
      if (operation && operation !== "DELETE" && req.object?.metadata?.namespace === ignoredNS) {
        return true;
      }
    }
  }

  // check if watch object is in ignored namespace
  if (obj && obj.metadata && obj.metadata.namespace) {
    if (ignoredNamespaces.includes(obj.metadata.namespace)) {
      return `Ignoring Watch Callback: Object name ${obj.metadata?.name} is in an ignored namespace ${ignoredNamespaces.join(", ")}.`;
    } else {
      return "";
    }
  }

  return false;
}

export function matchesRegex(pattern: string, testString: string): boolean {
  // edge-case
  if (!pattern) {
    return false;
  }

  const regex = new RegExp(pattern);
  return regex.test(testString);
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

type RBACMap = {
  [key: string]: {
    verbs: string[];
    plural: string;
  };
};

// check for overlap with labels and annotations between bindings and kubernetes objects
export function checkOverlap(bindingFilters: Record<string, string>, objectFilters: Record<string, string>): boolean {
  // True if labels/annotations are empty
  if (Object.keys(bindingFilters).length === 0) {
    return true;
  }

  let matchCount = 0;

  for (const key in bindingFilters) {
    // object must have label/annotation
    if (Object.prototype.hasOwnProperty.call(objectFilters, key)) {
      const val1 = bindingFilters[key];
      const val2 = objectFilters[key];

      // If bindingFilter has empty value for this key, only need to ensure objectFilter has this key
      if (val1 === "" && key in objectFilters) {
        matchCount++;
      }
      // If bindingFilter has a value, it must match the value in objectFilter
      else if (val1 !== "" && val1 === val2) {
        matchCount++;
      }
    }
  }

  // For single-key objects in bindingFilter or matching all keys in multiple-keys scenario
  return matchCount === Object.keys(bindingFilters).length;
}

export function filterNoMatchReasonRegex(
  binding: Partial<Binding>,
  obj: Partial<KubernetesObject>,
  capabilityNamespaces: string[],
  ignoredNamespaces?: string[],
): string {
  const { regexNamespaces, regexName } = binding.filters || {};
  const result = filterNoMatchReason(binding, obj, capabilityNamespaces);
  if (result === "") {
    if (Array.isArray(regexNamespaces) && regexNamespaces.length > 0) {
      for (const regexNamespace of regexNamespaces) {
        if (!matchesRegex(regexNamespace, obj.metadata?.namespace || "")) {
          return `Ignoring Watch Callback: Object namespace ${obj.metadata?.namespace} does not match regex ${regexNamespace}.`;
        }
      }
    }
    if (regexName && regexName !== "" && !matchesRegex(regexName, obj.metadata?.name || "")) {
      return `Ignoring Watch Callback: Object name ${obj.metadata?.name} does not match regex ${regexName}.`;
    }
  }

  const ignoredNS = ignoredNSObjectViolation({}, obj, ignoredNamespaces);
  if (ignoredNS !== "" && typeof ignoredNS === "string") {
    return ignoredNS;
  }

  return result;
}

export const definesDeletionTimestamp = pipe(binding => binding?.filters?.deletionTimestamp, defaultTo(false));
export const ignoresDeletionTimestamp = complement(definesDeletionTimestamp);

export const carriesDeletionTimestamp = pipe(obj => !!obj.metadata?.deletionTimestamp, defaultTo(false));
export const missingDeletionTimestamp = complement(carriesDeletionTimestamp);

export const mismatchedDeletionTimestamp = allPass([
  pipe(nthArg(0), definesDeletionTimestamp),
  pipe(nthArg(1), missingDeletionTimestamp),
]);

export const definedName = pipe(binding => binding?.filters?.name, defaultTo(""));
export const definesName = pipe(definedName, equals(""), not);
export const ignoresName = complement(definesName);

export const carriedName = pipe(obj => obj?.metadata?.name, defaultTo(""));
export const carriesName = pipe(carriedName, equals(""), not);
export const missingName = complement(carriesName);

export const mismatchedName = allPass([
  pipe(nthArg(0), definesName),
  pipe((bnd, obj) => definedName(bnd) !== carriedName(obj)),
]);

export const boundKind = pipe(binding => binding?.kind?.kind, defaultTo(""));
export const bindsToKind = curry(
  allPass([pipe(nthArg(0), boundKind, equals(""), not), pipe((bnd, knd) => boundKind(bnd) === knd)]),
);
export const bindsToNamespace = curry(pipe(bindsToKind(__, "Namespace")));
export const definedNamespaces = pipe(binding => binding?.filters?.namespaces, defaultTo([]));
export const definesNamespaces = pipe(definedNamespaces, equals([]), not);

export const carriedNamespace = pipe(obj => obj?.metadata?.namespace, defaultTo(""));
export const carriesNamespace = pipe(carriedNamespace, equals(""), not);

export const misboundNamespace = allPass([bindsToNamespace, definesNamespaces]);
export const mismatchedNamespace = allPass([
  pipe(nthArg(0), definesNamespaces),
  pipe((bnd, obj) => definedNamespaces(bnd).includes(carriedNamespace(obj)), not),
]);

export const definedAnnotations = pipe(binding => binding?.filters?.annotations, defaultTo({}));
export const definesAnnotations = pipe(definedAnnotations, equals({}), not);

export const carriedAnnotations = pipe(obj => obj?.metadata?.annotations, defaultTo({}));
export const carriesAnnotations = pipe(carriedAnnotations, equals({}), not);

export const metasMismatch = pipe(
  (defined, carried) => {
    const result = { defined, carried, unalike: {} };

    result.unalike = Object.entries(result.defined)
      .map(([key, val]) => {
        const keyMissing = !Object.hasOwn(result.carried, key);
        const noValue = !val;
        const valMissing = !result.carried[key];

        // prettier-ignore
        return (
          keyMissing ? { [key]: val } :
          noValue ? {} :
          valMissing ? { [key]: val } :
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

export const definedLabels = pipe(binding => binding?.filters?.labels, defaultTo({}));
export const definesLabels = pipe(definedLabels, equals({}), not);

export const carriedLabels = pipe(obj => obj?.metadata?.labels, defaultTo({}));
export const carriesLabels = pipe(carriedLabels, equals({}), not);

export const mismatchedLabels = allPass([
  pipe(nthArg(0), definesLabels),
  pipe((bnd, obj) => metasMismatch(definedLabels(bnd), carriedLabels(obj))),
]);

export const uncarryableNamespace = allPass([
  pipe(nthArg(0), length, gt(__, 0)),
  pipe(nthArg(1), carriesNamespace),
  pipe((nss, obj) => nss.includes(carriedNamespace(obj)), not),
]);

export const unbindableNamespaces = allPass([
  pipe(nthArg(0), length, gt(__, 0)),
  pipe(nthArg(1), definesNamespaces),
  pipe((nss, bnd) => difference(definedNamespaces(bnd), nss), length, equals(0), not),
]);

/**
 * Decide to run callback after the event comes back from API Server
 **/
export function filterNoMatchReason(
  binding: Partial<Binding>,
  obj: Partial<KubernetesObject>,
  capabilityNamespaces: string[],
): string {
  const prefix = "Ignoring Watch Callback:";

  // prettier-ignore
  return (
    mismatchedDeletionTimestamp(binding, obj) ?
      `${prefix} Binding defines deletionTimestamp but Object does not carry it.` :

    mismatchedName(binding, obj) ?
      `${prefix} Binding defines name '${definedName(binding)}' but Object carries '${carriedName(obj)}'.` :

    misboundNamespace(binding) ?
      `${prefix} Cannot use namespace filter on a namespace object.` :

    mismatchedLabels(binding, obj) ?
      (
        `${prefix} Binding defines labels '${JSON.stringify(definedLabels(binding))}' ` +
        `but Object carries '${JSON.stringify(carriedLabels(obj))}'.`
      ) :

    mismatchedAnnotations(binding, obj) ?
      (
        `${prefix} Binding defines annotations '${JSON.stringify(definedAnnotations(binding))}' ` +
        `but Object carries '${JSON.stringify(carriedAnnotations(obj))}'.`
      ) :

    uncarryableNamespace(capabilityNamespaces, obj) ?
      (
        `${prefix} Object carries namespace '${carriedNamespace(obj)}' ` +
        `but namespaces allowed by Capability are '${JSON.stringify(capabilityNamespaces)}'`
      ) :

    unbindableNamespaces(capabilityNamespaces, binding) ?
      (
        `${prefix} Binding defines namespaces ${JSON.stringify(definedNamespaces(binding))} ` +
        `but namespaces allowed by Capability are '${JSON.stringify(capabilityNamespaces)}'`
      ) :

    mismatchedNamespace(binding, obj) ?
      (
        `${prefix} Binding defines namespaces '${JSON.stringify(definedNamespaces(binding))}' ` +
        `but Object carries '${carriedNamespace(obj)}'.`
      ):

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
    });

    return acc;
  }, {});
}

export async function createDirectoryIfNotExists(path: string) {
  try {
    await fs.access(path);
  } catch (error) {
    if (error.code === "ENOENT") {
      await fs.mkdir(path, { recursive: true });
    } else {
      throw error;
    }
  }
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

// namespaceComplianceValidator ensures that capability bindinds respect ignored and capability namespaces
export function namespaceComplianceValidator(capability: CapabilityExport, ignoredNamespaces?: string[]) {
  const { namespaces: capabilityNamespaces, bindings, name } = capability;
  const bindingNamespaces = bindings.flatMap((binding: Binding) => binding.filters.namespaces);
  const bindingRegexNamespaces = bindings.flatMap((binding: Binding) => binding.filters.regexNamespaces || []);

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
      for (const capabilityNamespace of capabilityNamespaces) {
        if (regexNamespace !== "" && matchesRegex(regexNamespace, capabilityNamespace)) {
          matches = true;
          break;
        }
      }
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
      for (const ignoredNS of ignoredNamespaces) {
        if (matchesRegex(regexNamespace, ignoredNS)) {
          throw new Error(
            `Ignoring Watch Callback: Regex namespace: ${regexNamespace}, is an ignored namespace: ${ignoredNS}.`,
          );
        }
      }
    }
  }
}

// check to see if all replicas are ready for all deployments in the pepr-system namespace
// returns true if all deployments are ready, false otherwise
export async function checkDeploymentStatus(namespace: string) {
  const deployments = await K8s(kind.Deployment).InNamespace(namespace).Get();
  let status = false;
  let readyCount = 0;

  for (const deployment of deployments.items) {
    const readyReplicas = deployment.status?.readyReplicas ? deployment.status?.readyReplicas : 0;
    if (deployment.status?.readyReplicas !== deployment.spec?.replicas) {
      Log.info(
        `Waiting for deployment ${deployment.metadata?.name} rollout to finish: ${readyReplicas} of ${deployment.spec?.replicas} replicas are available`,
      );
    } else {
      Log.info(
        `Deployment ${deployment.metadata?.name} rolled out: ${readyReplicas} of ${deployment.spec?.replicas} replicas are available`,
      );
      readyCount++;
    }
  }
  if (readyCount === deployments.items.length) {
    status = true;
  }
  return status;
}

// wait for all deployments in the pepr-system namespace to be ready
export async function namespaceDeploymentsReady(namespace: string = "pepr-system") {
  Log.info(`Checking ${namespace} deployments status...`);
  let ready = false;
  while (!ready) {
    ready = await checkDeploymentStatus(namespace);
    if (ready) {
      return ready;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  Log.info(`All ${namespace} deployments are ready`);
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
export function dedent(file: string) {
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

export function replaceString(str: string, stringA: string, stringB: string) {
  //eslint-disable-next-line
  const escapedStringA = stringA.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  const regExp = new RegExp(escapedStringA, "g");
  return str.replace(regExp, stringB);
}
