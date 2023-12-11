// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { K8s, KubernetesListObject, kind } from "kubernetes-fluent-client";
import Log from "./logger";
import { CapabilityExport } from "./types";
import { promises as fs } from "fs";

type RBACMap = {
  [key: string]: {
    verbs: string[];
    plural: string;
  };
};

export const addVerbIfNotExists = (verbs: string[], verb: string) => {
  if (!verbs.includes(verb)) {
    verbs.push(verb);
  }
};

export const createRBACMap = (capabilities: CapabilityExport[]): RBACMap => {
  return capabilities.reduce((acc: RBACMap, capability: CapabilityExport) => {
    capability.bindings.forEach(binding => {
      const key = `${binding.kind.group}/${binding.kind.version}/${binding.kind.kind}`;

      acc["pepr.dev/v1/peprstore"] = {
        verbs: ["create", "get", "patch", "watch"],
        plural: "peprstores",
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
};

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
    )}] capabilityNamespaces:$[${capabilityNamespaces.join(", ")}].`;
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


// Helper to wait for all resources to be fully up during deployment

// get all deployments
export async function getDeployments() {
  const deployments = await K8s(kind.Deployment).InNamespace('pepr-system').Get();
  return deployments;
}

// waits for all replicas to be ready for all deployments
export async function waitForAllDeploymentReplicas(deployments: KubernetesListObject<kind.Deployment>) {
  let status = false;
  let readyCount = 0;

  if (deployments.items.length === 0) {
    Log.info('No deployments found');
    return status;
  }

  for (const deployment of deployments.items) {
    Log.info(`${deployment.metadata?.namespace}/${deployment.metadata?.name} is deploying`)

    while (deployment.status?.readyReplicas !== deployment.spec?.replicas) {
      const readyReplicas = deployment.status?.readyReplicas ? deployment.status?.readyReplicas : 0;
      Log.info(`${deployment.metadata?.namespace}/${deployment.metadata?.name} is not ready - ${readyReplicas} ready replicas out of ${deployment.spec?.replicas} spec replicas`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

      Log.info(`${deployment.metadata?.namespace}/${deployment.metadata?.name} is ready with ${deployment.status?.readyReplicas} ready replicas out of ${deployment.spec?.replicas} spec replicas`);
      readyCount++;
      Log.info(`${readyCount} deployments ready out of ${deployments.items.length} deployments`);

  }

  if (readyCount === deployments.items.length) {
    status = true;
  }

  return status
}

// check to see if all replicas are ready for all deployments
export async function checkAllDeploymentReplicas() {
  const deployments = await getDeployments();
  const status = await waitForAllDeploymentReplicas(deployments);
  return status
}
