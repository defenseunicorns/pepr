// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { kind } from "kubernetes-fluent-client";
import fs from "fs";
import path from "path";
import Log from "../logger";
import { V1Role, V1ClusterRole } from "@kubernetes/client-node";
import { CapabilityExport } from "../types";
import { createRBACMap } from "../helpers";
//import { groupBy, uniq } from "lodash";
interface CustomRBACConfig {
  roles?: V1Role[];
  clusterRoles?: V1ClusterRole[];
}

interface PackageJson {
  pepr?: PeprConfig;
}

interface PeprConfig {
  rbac?: CustomRBACConfig;
}

interface KubernetesResource {
  metadata?: {
    name?: string;
  };
  rules?: Array<{
    apiGroups?: string[];
    resources?: string[];
    verbs?: string[];
  }>;
}

/**
 * Extracts custom rules for ClusterRoles from the custom RBAC configuration.
 * This function returns only the rules defined in the package.json, not the full ClusterRole objects.
 * @returns {object[]} An array of rules for ClusterRoles.
 */
export function getCustomClusterRoleRules(packageData?: PackageJson): object[] {
  const customClusterRoles = getCustomRBACField("clusterRoles", packageData);
  Log.info(`Custom ClusterRole rules extracted: ${JSON.stringify(customClusterRoles, null, 2)}`);

  const mergedRules: {
    [key: string]: { apiGroups: string[] | undefined; resources: string[] | undefined; verbs: Set<string> };
  } = {};

  (customClusterRoles ?? []).forEach(clusterRole => {
    (clusterRole.rules || []).forEach(rule => {
      const key = `${rule.apiGroups}-${rule.resources}`;
      if (!mergedRules[key]) {
        mergedRules[key] = {
          apiGroups: rule.apiGroups,
          resources: rule.resources,
          verbs: new Set(rule.verbs),
        };
      } else {
        rule.verbs.forEach(verb => mergedRules[key].verbs.add(verb));
      }
    });
  });

  return Object.values(mergedRules).map(rule => ({
    apiGroups: rule.apiGroups,
    resources: rule.resources,
    verbs: Array.from(rule.verbs),
  }));
}

/**
 * Extracts custom rules for Roles from the custom RBAC configuration.
 * This function returns only the rules defined in the package.json, not the full Role objects.
 * The rules are consolidated by combining verbs for identical apiGroups and resources.
 * @returns {object[]} An array of merged rules for Roles.
 */
export function getCustomStoreRoleRules(packageData?: PackageJson): object[] {
  const customRoles = getCustomRBACField("roles", packageData);
  Log.info(`Custom Role rules extracted: ${JSON.stringify(customRoles, null, 2)}`);

  const mergedRules: {
    [key: string]: { apiGroups: string[] | undefined; resources: string[] | undefined; verbs: Set<string> };
  } = {};

  (customRoles ?? []).forEach(role => {
    (role.rules || []).forEach(rule => {
      const key = `${rule.apiGroups}-${rule.resources}`;
      if (!mergedRules[key]) {
        mergedRules[key] = {
          apiGroups: rule.apiGroups,
          resources: rule.resources,
          verbs: new Set(rule.verbs),
        };
      } else {
        rule.verbs.forEach(verb => mergedRules[key].verbs.add(verb));
      }
    });
  });

  // Convert verbs from Set to Array to avoid duplication and make it a simple object
  return Object.values(mergedRules).map(rule => ({
    apiGroups: rule.apiGroups,
    resources: rule.resources,
    verbs: Array.from(rule.verbs),
  }));
}

/**
 * Retrieves a specific field from the custom RBAC configuration.
 * If the field is missing or empty, logs a message and returns an empty array.
 * @param {K} field - The field of the CustomRBACConfig to retrieve.
 * @returns {CustomRBACConfig[K]} The value of the specified field.
 */
export function getCustomRBACField<K extends keyof CustomRBACConfig>(
  field: K,
  packageData?: PackageJson,
): CustomRBACConfig[K] {
  const customRBAC = readCustomRBAC(packageData);

  // Check if customRBAC[field] exists and is an array, else return an empty array
  if (!Array.isArray(customRBAC?.[field]) || customRBAC?.[field]?.length === 0) {
    Log.info(`No custom RBAC items found for ${field}. Processing will continue without these items.`);
    return [] as CustomRBACConfig[K];
  }

  Log.info(`Custom RBAC items found for ${field}: ${JSON.stringify(customRBAC[field], null, 2)}`);
  return customRBAC[field];
}

/**
 * Validates the RBAC configuration specifically for Roles and ClusterRoles.
 * Logs an error if required fields are missing and skips those entries.
 * @param {CustomRBACConfig} rbacConfig - The RBAC configuration to validate.
 * @returns {CustomRBACConfig} The validated RBAC configuration containing only Roles and ClusterRoles.
 */
function validateRBACConfig(rbacConfig: CustomRBACConfig): CustomRBACConfig {
  return {
    roles: validateRoleEntries(rbacConfig.roles ?? [], "roles"),
    clusterRoles: validateRoleEntries(rbacConfig.clusterRoles ?? [], "clusterRoles"),
  };
}

/**
 * Validates a list of role entries (either Roles or ClusterRoles).
 * Logs messages for invalid items and skips them in the result.
 * @param {V1Role[] | V1ClusterRole[]} roles - The list of roles to validate.
 * @param {string} itemName - The name of the role type being validated.
 * @returns {V1Role[] | V1ClusterRole[]} The list of valid roles.
 */
function validateRoleEntries<T extends V1Role | V1ClusterRole>(roles: T[], itemName: string): T[] {
  if (!Array.isArray(roles)) {
    Log.warn(`Invalid ${itemName} entries: Expected an array but got ${typeof roles}`);
    return [];
  }

  return roles.filter(role => {
    if (!role || typeof role !== "object" || !role.rules || !Array.isArray(role.rules)) {
      Log.warn(`Invalid ${itemName} entry: Missing required 'rules' array`);
      return false;
    }
    return validateRoleItem(role, itemName);
  });
}

/**
 * Validates a single Role or ClusterRole item.
 * Checks if the required fields are present and logs any issues found.
 * @param {KubernetesResource} role - The role to validate.
 * @param {string} itemName - The name of the role type being validated.
 * @returns {boolean} True if the role is valid, false otherwise.
 */
function validateRoleItem(role: KubernetesResource, itemName: string): boolean {
  if (!role || typeof role !== "object") {
    Log.warn(`Invalid ${itemName} item: Expected an object but got ${typeof role}`);
    return false;
  }
  return true;
}

/**
 * Reads the custom RBAC configuration from the package.json file.
 * @returns {CustomRBACConfig} The custom RBAC configuration.
 */
export function readCustomRBAC(packageData?: PackageJson): CustomRBACConfig {
  try {
    const data = packageData || readPackageJson();
    const peprConfig: PeprConfig = getPeprConfig(data);
    const rbacConfig: CustomRBACConfig = getRBACConfig(peprConfig);

    Log.info(`RBAC configuration successfully extracted: ${JSON.stringify(rbacConfig, null, 2)}`);
    return validateRBACConfig(rbacConfig);
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)));
    return createEmptyRBACConfig();
  }
}

/**
 * Reads and parses the package.json file.
 * @returns {PackageJson} The parsed package.json data.
 * @throws {PackageJsonError} If the package.json file cannot be read or parsed.
 */
export function readPackageJson(): PackageJson {
  try {
    const packageJsonPath = path.resolve(process.cwd(), "package.json");
    const fileContent = fs.readFileSync(packageJsonPath, "utf8");
    Log.info(`Reading package.json from: ${packageJsonPath}`);
    Log.info(`File content read from package.json: ${fileContent}`); // Log the raw file content
    const parsedContent = JSON.parse(fileContent);
    Log.info(`Parsed package.json content: ${JSON.stringify(parsedContent, null, 2)}`); // Log the parsed content
    return parsedContent as PackageJson;
  } catch (error) {
    throw new Error(`Error reading or parsing package.json: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Retrieves the pepr configuration from the package.json data.
 * @param {PackageJson} packageData - The parsed package.json data.
 * @returns {PeprConfig} The pepr configuration.
 */
export function getPeprConfig(packageData: PackageJson): PeprConfig {
  if (!packageData || !packageData.pepr) {
    Log.info("No 'pepr' configuration found in package.json.");
    return {};
  }
  return packageData.pepr;
}

/**
 * Retrieves the RBAC configuration from the pepr configuration.
 * @param {PeprConfig} peprConfig - The pepr configuration.
 * @returns {CustomRBACConfig} The RBAC configuration.
 */
function getRBACConfig(peprConfig: PeprConfig): CustomRBACConfig {
  if (!peprConfig.rbac) {
    Log.info("Missing RBAC configuration in package.json.");
    return createEmptyRBACConfig();
  }
  return peprConfig.rbac;
}

/**
 * Creates an empty RBAC configuration.
 * @returns {CustomRBACConfig} An empty RBAC configuration.
 */
function createEmptyRBACConfig(): CustomRBACConfig {
  return {
    roles: [],
    clusterRoles: [],
  };
}

/**
 * Logs the error with a specific message based on its type.
 * @param {Error} error - The error to be logged.
 */
function logError(error: Error): void {
  Log.error(`Error occurred: ${error.message}`);
}

/**
 * Generates a ClusterRole with access to cluster resources based on the provided capabilities.
 * @param {string} name - The name of the ClusterRole.
 * @param {CapabilityExport[]} capabilities - The capabilities to use for generating the rules.
 * @param {string} [rbacMode=""] - The RBAC mode to use.
 * @todo: should dynamically generate this based on resources used by the module. will also need to explore how this should work for multiple modules.
 * @returns {kind.ClusterRole} The generated ClusterRole.
 */
export function getClusterRoles(
  name: string,
  capabilities: CapabilityExport[],
  rbacMode: string = "",
): kind.ClusterRole {
  const rbacMap = createRBACMap(capabilities);
  return {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "ClusterRole",
    metadata: { name },
    rules:
      rbacMode === "scoped"
        ? [
            ...Object.keys(rbacMap).map(key => {
              // let group:string, version:string, kind:string;
              let group: string;
              key.split("/").length < 3 ? (group = "") : (group = key.split("/")[0]);

              return {
                apiGroups: [group],
                resources: [rbacMap[key].plural],
                verbs: rbacMap[key].verbs,
              };
            }),
          ]
        : [
            {
              apiGroups: ["*"],
              resources: ["*"],
              verbs: ["create", "delete", "get", "list", "patch", "update", "watch"],
            },
          ],
  };
}

/**
 * Generates a ClusterRoleBinding for the specified name.
 * @param {string} name - The name of the ClusterRoleBinding.
 * @returns {kind.ClusterRoleBinding} The generated ClusterRoleBinding.
 */
export function getClusterRoleBindings(name: string): kind.ClusterRoleBinding {
  return {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "ClusterRoleBinding",
    metadata: { name },
    roleRef: {
      apiGroup: "rbac.authorization.k8s.io",
      kind: "ClusterRole",
      name,
    },
    subjects: [
      {
        kind: "ServiceAccount",
        name,
        namespace: "pepr-system",
      },
    ],
  };
}

/**
 * Generates a ServiceAccount for the specified name.
 * @param {string} name - The name of the ServiceAccount.
 * @returns {kind.ServiceAccount} The generated ServiceAccount.
 */
export function getServiceAccounts(name: string): kind.ServiceAccount {
  return {
    apiVersion: "v1",
    kind: "ServiceAccount",
    metadata: {
      name,
      namespace: "pepr-system",
    },
  };
}

/**
 * Generates a Role for the specified name with store-specific permissions.
 * @param {string} name - The base name for the Role.
 * @returns {kind.Role} The generated Role with store-specific permissions.
 */
export function getStoreRoles(name: string): kind.Role {
  name = `${name}-store`;
  return {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "Role",
    metadata: { name, namespace: "pepr-system" },
    rules: [
      {
        apiGroups: ["pepr.dev"],
        resources: ["peprstores"],
        resourceNames: [""],
        verbs: ["create", "get", "patch", "watch"],
      },
    ],
  };
}

/**
 * Generates a RoleBinding for the specified name with store-specific permissions.
 * @param {string} name - The base name for the RoleBinding.
 * @returns {kind.RoleBinding} The generated RoleBinding with store-specific permissions.
 */
export function getStoreRoleBindings(name: string): kind.RoleBinding {
  name = `${name}-store`;
  return {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "RoleBinding",
    metadata: { name, namespace: "pepr-system" },
    roleRef: {
      apiGroup: "rbac.authorization.k8s.io",
      kind: "Role",
      name,
    },
    subjects: [
      {
        kind: "ServiceAccount",
        name,
        namespace: "pepr-system",
      },
    ],
  };
}
