// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { promises as fs } from "fs";
import { K8s, KubernetesObject, kind } from "kubernetes-fluent-client";
import Log from "./logger";
import { Binding, CapabilityExport } from "./types";

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

/**
 * Decide to run callback after the event comes back from API Server
 **/
export function filterNoMatchReason(
  binding: Partial<Binding>,
  obj: Partial<KubernetesObject>,
  capabilityNamespaces: string[],
): string {
  // binding kind is namespace with a InNamespace filter
  if (binding.kind && binding.kind.kind === "Namespace" && binding.filters && binding.filters.namespaces.length !== 0) {
    return `Ignoring Watch Callback: Cannot use a namespace filter in a namespace object.`;
  }

  if (typeof obj === "object" && obj !== null && "metadata" in obj && obj.metadata !== undefined && binding.filters) {
    // binding labels and object labels dont match
    if (obj.metadata.labels && !checkOverlap(binding.filters.labels, obj.metadata.labels)) {
      return `Ignoring Watch Callback: No overlap between binding and object labels. Binding labels ${JSON.stringify(
        binding.filters.labels,
      )}, Object Labels ${JSON.stringify(obj.metadata.labels)}.`;
    }

    // binding annotations and object annotations dont match
    if (obj.metadata.annotations && !checkOverlap(binding.filters.annotations, obj.metadata.annotations)) {
      return `Ignoring Watch Callback: No overlap between binding and object annotations. Binding annotations ${JSON.stringify(
        binding.filters.annotations,
      )}, Object annotations ${JSON.stringify(obj.metadata.annotations)}.`;
    }
  }

  // Check object is in the capability namespace
  if (
    Array.isArray(capabilityNamespaces) &&
    capabilityNamespaces.length > 0 &&
    obj.metadata &&
    obj.metadata.namespace &&
    !capabilityNamespaces.includes(obj.metadata.namespace)
  ) {
    return `Ignoring Watch Callback: Object is not in the capability namespace. Capability namespaces: ${capabilityNamespaces.join(
      ", ",
    )}, Object namespace: ${obj.metadata.namespace}.`;
  }

  // chceck every filter namespace is a capability namespace
  if (
    Array.isArray(capabilityNamespaces) &&
    capabilityNamespaces.length > 0 &&
    binding.filters &&
    Array.isArray(binding.filters.namespaces) &&
    binding.filters.namespaces.length > 0 &&
    !binding.filters.namespaces.every(ns => capabilityNamespaces.includes(ns))
  ) {
    return `Ignoring Watch Callback: Binding namespace is not part of capability namespaces. Capability namespaces: ${capabilityNamespaces.join(
      ", ",
    )}, Binding namespaces: ${binding.filters.namespaces.join(", ")}.`;
  }

  // filter namespace is not the same of object namespace
  if (
    binding.filters &&
    Array.isArray(binding.filters.namespaces) &&
    binding.filters.namespaces.length > 0 &&
    obj.metadata &&
    obj.metadata.namespace &&
    !binding.filters.namespaces.includes(obj.metadata.namespace)
  ) {
    return `Ignoring Watch Callback: Binding namespace and object namespace are not the same. Binding namespaces: ${binding.filters.namespaces.join(
      ", ",
    )}, Object namespace: ${obj.metadata.namespace}.`;
  }

  // no problems
  return "";
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
  const bindingNamespaces = bindings.flatMap(binding => binding.filters.namespaces);

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
