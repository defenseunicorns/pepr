// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { kind } from "kubernetes-fluent-client";
import { CapabilityExport } from "../types";
import { createRBACMap } from "../helpers";
import fs from "fs";
import path from "path";
import Log from "../logger";
import { V1Role, V1ClusterRole, V1RoleBinding, V1ClusterRoleBinding } from "@kubernetes/client-node";

interface CustomRBACConfig {
  roles: V1Role[];
  clusterRoles: V1ClusterRole[];
  roleBindings: V1RoleBinding[];
  clusterRoleBindings: V1ClusterRoleBinding[];
  serviceAccounts: kind.ServiceAccount[];
  storeRoles: V1Role[];
  storeRoleBindings: V1RoleBinding[];
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
}

class PackageJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PackageJsonError";
  }
}

class PeprConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PeprConfigError";
  }
}

class RBACConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RBACConfigError";
  }
}

/**
 * Retrieves a specific field from the custom RBAC configuration.
 * If the field is missing or empty, logs a message and returns an empty array.
 * @param {K} field - The field of the CustomRBACConfig to retrieve.
 * @returns {CustomRBACConfig[K]} The value of the specified field.
 */
function getCustomRBACField<K extends keyof CustomRBACConfig>(field: K): CustomRBACConfig[K] {
  const customRBAC = readCustomRBAC();
  if (!customRBAC[field] || customRBAC[field].length === 0) {
    Log.info(`No custom RBAC items found for ${field}. Processing will continue without these items.`);
  }
  return Array.isArray(customRBAC[field]) ? customRBAC[field] : [];
}

/**
 * Logs the error with a specific message based on its type.
 * @param {Error} error - The error to be logged.
 */
function logError(error: Error): void {
  if (error instanceof PackageJsonError) {
    Log.error("PackageJsonError:", error.message);
  } else if (error instanceof PeprConfigError) {
    Log.error("PeprConfigError:", error.message);
  } else if (error instanceof RBACConfigError) {
    Log.error("RBACConfigError:", error.message);
  } else {
    Log.error("Unknown error occurred:", error.message);
  }
}

/**
 * Reads the custom RBAC configuration from the package.json file.
 * @returns {CustomRBACConfig} The custom RBAC configuration.
 */
export function readCustomRBAC(): CustomRBACConfig {
  try {
    const packageData: PackageJson = readPackageJson();
    const peprConfig: PeprConfig = getPeprConfig(packageData);
    const rbacConfig: CustomRBACConfig = getRBACConfig(peprConfig);

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
function readPackageJson(): PackageJson {
  try {
    const packageJsonPath = path.resolve(process.cwd(), "package.json");
    const fileContent = fs.readFileSync(packageJsonPath, "utf8");
    return JSON.parse(fileContent) as PackageJson;
  } catch (error) {
    throw new PackageJsonError(
      "Error reading or parsing package.json: " + (error instanceof Error ? error.message : String(error)),
    );
  }
}

/**
 * Retrieves the pepr configuration from the package.json data.
 * @param {PackageJson} packageData - The parsed package.json data.
 * @returns {PeprConfig} The pepr configuration.
 * @throws {PeprConfigError} If the pepr configuration is missing.
 */
function getPeprConfig(packageData: PackageJson): PeprConfig {
  if (!packageData || !packageData.pepr) {
    Log.info("No 'pepr' configuration found in package.json. Default values will be used.");
    return {};
  }
  return packageData.pepr;
}

/**
 * Retrieves the RBAC configuration from the pepr configuration.
 * @param {PeprConfig} peprConfig - The pepr configuration.
 * @returns {CustomRBACConfig} The RBAC configuration.
 * @throws {RBACConfigError} If the RBAC configuration is missing.
 */
function getRBACConfig(peprConfig: PeprConfig): CustomRBACConfig {
  if (!peprConfig.rbac) {
    Log.info("Missing RBAC configuration in package.json.");
    return createEmptyRBACConfig();
  }
  return peprConfig.rbac;
}

/**
 * Validates the RBAC configuration.
 * Logs an error if required fields are missing and skips those entries.
 * @param {CustomRBACConfig} rbacConfig - The RBAC configuration to validate.
 * @returns {CustomRBACConfig} The validated RBAC configuration.
 */
function validateRBACConfig(rbacConfig: CustomRBACConfig): CustomRBACConfig {
  return {
    roles: validateEntries(rbacConfig.roles, "roles"),
    clusterRoles: validateEntries(rbacConfig.clusterRoles, "clusterRoles"),
    roleBindings: validateEntries(rbacConfig.roleBindings, "roleBindings"),
    clusterRoleBindings: validateEntries(rbacConfig.clusterRoleBindings, "clusterRoleBindings"),
    serviceAccounts: validateEntries(rbacConfig.serviceAccounts, "serviceAccounts"),
    storeRoles: validateEntries(rbacConfig.storeRoles, "storeRoles"),
    storeRoleBindings: validateEntries(rbacConfig.storeRoleBindings, "storeRoleBindings"),
  };
}

/**
 * Validates a list of RBAC items.
 * Logs messages for invalid items and skips them in the result.
 * @param {KubernetesResource[]} items - The list of items to validate.
 * @param {string} itemName - The name of the item type being validated.
 * @returns {KubernetesResource[]} The list of valid items.
 */
function validateEntries<T extends KubernetesResource>(items: T[], itemName: string): T[] {
  if (!Array.isArray(items)) {
    Log.warn(`Invalid ${itemName} entries: Expected an array but got ${typeof items}`);
    return [];
  }

  return items.filter(item => validateItem(item, itemName));
}

/**
 * Validates a single RBAC item.
 * Checks if the required fields are present and logs any issues found.
 * @param {KubernetesResource} item - The item to validate.
 * @param {string} itemName - The name of the item type being validated.
 * @returns {boolean} True if the item is valid, false otherwise.
 */
function validateItem(item: KubernetesResource, itemName: string): boolean {
  if (!item || typeof item !== "object") {
    Log.warn(`Invalid ${itemName} item: Expected an object but got ${typeof item}`);
    return false;
  }

  if (!item.metadata || !item.metadata.name) {
    Log.warn(`Invalid ${itemName} item: Missing required 'metadata.name' field`);
    return false;
  }

  return true;
}

/**
 * Creates an empty RBAC configuration.
 * @returns {CustomRBACConfig} An empty RBAC configuration.
 */
function createEmptyRBACConfig(): CustomRBACConfig {
  return {
    roles: [],
    clusterRoles: [],
    roleBindings: [],
    clusterRoleBindings: [],
    serviceAccounts: [],
    storeRoles: [],
    storeRoleBindings: [],
  };
}

/**
 * Generates a ClusterRole with access to cluster resources based on the provided capabilities.
 * @param {string} name - The name of the ClusterRole.
 * @param {CapabilityExport[]} capabilities - The capabilities to use for generating the rules.
 * @param {string} [rbacMode=""] - The RBAC mode to use.
 * @todo: should dynamically generate this based on resources used by the module. will also need to explore how this should work for multiple modules.
 * @returns {kind.ClusterRole} The generated ClusterRole.
 */
export function getGeneratedClusterRoles(
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
 * Retrieves all custom ClusterRoles from the custom RBAC configuration.
 * @returns {V1ClusterRole[]} An array of custom ClusterRoles.
 */
export function getCustomClusterRoles(): V1ClusterRole[] {
  return getCustomRBACField("clusterRoles");
}

/**
 * Retrieves all ClusterRoles including both generated and custom roles.
 * @param {string} name - The name of the ClusterRole.
 * @param {CapabilityExport[]} capabilities - The capabilities to use for generating the rules.
 * @param {string} [rbacMode=""] - The RBAC mode to use.
 * @returns {kind.ClusterRole[]} An array of all ClusterRoles.
 */
export function getAllClusterRoles(
  name: string,
  capabilities: CapabilityExport[],
  rbacMode: string = "",
): kind.ClusterRole[] {
  const generatedClusterRole = getGeneratedClusterRoles(name, capabilities, rbacMode);
  const customClusterRoles = getCustomClusterRoles();
  return [generatedClusterRole, ...customClusterRoles];
}

/**
 * Generates a ClusterRoleBinding for the specified name.
 * @param {string} name - The name of the ClusterRoleBinding.
 * @returns {kind.ClusterRoleBinding} The generated ClusterRoleBinding.
 */
export function getGeneratedClusterRoleBindings(name: string): kind.ClusterRoleBinding {
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
 * Retrieves custom ClusterRoleBindings from the custom RBAC configuration.
 * @returns {kind.ClusterRoleBinding[]} An array of custom ClusterRoleBindings.
 */
export function getCustomClusterRoleBindings(): kind.ClusterRoleBinding[] {
  // Fetch custom RBAC configuration from package.json
  const customRBAC = readCustomRBAC();
  return customRBAC.clusterRoleBindings || [];
}

/**
 * Combines generated and custom ClusterRoleBindings into a single list.
 * @param {string} name - The name of the generated ClusterRoleBinding.
 * @returns {kind.ClusterRoleBinding[]} An array of all ClusterRoleBindings.
 */
export function getAllClusterRoleBindings(name: string): kind.ClusterRoleBinding[] {
  const generatedClusterRoleBinding = getGeneratedClusterRoleBindings(name);
  const customClusterRoleBindings = getCustomClusterRoleBindings();
  return [generatedClusterRoleBinding, ...customClusterRoleBindings];
}

/**
 * Generates a ServiceAccount for the specified name.
 * @param {string} name - The name of the ServiceAccount.
 * @returns {kind.ServiceAccount} The generated ServiceAccount.
 */
export function getGeneratedServiceAccounts(name: string): kind.ServiceAccount {
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
 * Retrieves custom ServiceAccounts from the custom RBAC configuration.
 * @returns {kind.ServiceAccount[]} An array of custom ServiceAccounts.
 */
export function getCustomServiceAccounts(): kind.ServiceAccount[] {
  return getCustomRBACField("serviceAccounts");
}

/**
 * Combines generated and custom ServiceAccounts into a single list.
 * @param {string} name - The name of the generated ServiceAccount.
 * @returns {kind.ServiceAccount[]} An array of all ServiceAccounts.
 */
export function getAllServiceAccounts(name: string): kind.ServiceAccount[] {
  const generatedServiceAccount = getGeneratedServiceAccounts(name);
  const customServiceAccounts = getCustomServiceAccounts();
  return [generatedServiceAccount, ...customServiceAccounts];
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
 * Retrieves custom Roles from the custom RBAC configuration.
 * @returns {V1Role[]} An array of custom Roles.
 */
export function getCustomRoles(): V1Role[] {
  return getCustomRBACField("roles");
}

/**
 * Combines generated and custom Roles into a single list.
 * @param {string} name - The base name for the generated Role.
 * @returns {kind.Role[]} An array of all Roles.
 */
export function getAllRoles(name: string): kind.Role[] {
  const generatedRole = getStoreRoles(name);
  const customRoles = getCustomRoles();
  return [generatedRole, ...customRoles];
}

/**
 * Generates a RoleBinding for the specified name with store-specific permissions.
 * @param {string} name - The base name for the RoleBinding.
 * @returns {kind.RoleBinding} The generated RoleBinding with store-specific permissions.
 */
export function getGeneratedRoleBindings(name: string): kind.RoleBinding {
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

/**
 * Retrieves custom RoleBindings from the custom RBAC configuration.
 * @returns {V1RoleBinding[]} An array of custom RoleBindings.
 */
export function getCustomRoleBindings(): V1RoleBinding[] {
  return getCustomRBACField("roleBindings");
}

/**
 * Combines generated and custom RoleBindings into a single list.
 * @param {string} name - The base name for the generated RoleBinding.
 * @returns {kind.RoleBinding[]} An array of all RoleBindings.
 */
export function getAllRoleBindings(name: string): kind.RoleBinding[] {
  const generatedRoleBinding = getGeneratedRoleBindings(name);
  const customRoleBindings = getCustomRoleBindings();
  return [generatedRoleBinding, ...customRoleBindings];
}
