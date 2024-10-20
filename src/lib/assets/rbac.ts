// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { kind } from "kubernetes-fluent-client";
import fs from "fs";
import path from "path";
import Log from "../logger";
import { V1Role, V1ClusterRole } from "@kubernetes/client-node";
import { CapabilityExport } from "../types";
import { RBACMap } from "../helpers";

interface CustomRBACConfig {
  role?: V1Role[];
  clusterRole?: V1ClusterRole[];
}
interface PeprConfig {
  rbac?: CustomRBACConfig;
}

interface PackageJson {
  pepr?: PeprConfig;
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
 * Grants the controller access to cluster resources beyond the mutating webhook.
 *
 * @todo: should dynamically generate this based on resources used by the module. will also need to explore how this should work for multiple modules.
 * @returns
 */

/**
 * Generates a Kubernetes ClusterRole resource with the specified rules and RBAC mode,
 * and merges custom RBAC rules from package.json.
 *
 * @param {string} name - The name of the ClusterRole.
 * @param {CapabilityExport[]} capabilities - The capabilities that define the RBAC rules.
 * @param {string} [rbacMode=""] - The RBAC mode (e.g., "scoped") to determine the rule generation logic.
 * @param {PackageJson} [packageData] - Optional package.json data for extracting custom RBAC rules.
 * @returns {kind.ClusterRole} A Kubernetes ClusterRole object with the generated and merged custom rules.
 */
export function getClusterRole(
  name: string,
  capabilities: CapabilityExport[],
  rbacMode: string = "",
  packageData?: PackageJson,
): kind.ClusterRole {
  const rbacMap = createRBACMap(capabilities);

  // Generate dynamic rules based on capabilities
  const generatedRules =
    rbacMode === "scoped"
      ? Object.keys(rbacMap).map(key => {
          let group: string;
          key.split("/").length < 3 ? (group = "") : (group = key.split("/")[0]);
          return {
            apiGroups: [group],
            resources: [rbacMap[key].plural],
            verbs: rbacMap[key].verbs,
          };
        })
      : [
          {
            apiGroups: ["*"],
            resources: ["*"],
            verbs: ["create", "delete", "get", "list", "patch", "update", "watch"],
          },
        ];

  // Get custom cluster role rules from package.json
  const customClusterRules = getCustomClusterRoleRule(packageData);

  // Merge custom rules with generated rules
  const mergedRules = mergeRBACRules(generatedRules, customClusterRules);

  return {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "ClusterRole",
    metadata: { name },
    rules: mergedRules,
  };
}

/**
 * Generates a Kubernetes ClusterRoleBinding resource that binds a ClusterRole to a ServiceAccount.
 *
 * @param {string} name - The name of the ClusterRoleBinding.
 * @returns {kind.ClusterRoleBinding} A Kubernetes ClusterRoleBinding object.
 */
export function getClusterRoleBinding(name: string): kind.ClusterRoleBinding {
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
 * Generates a Kubernetes ServiceAccount resource with the specified name.
 *
 * @param {string} name - The name of the ServiceAccount.
 * @returns {kind.ServiceAccount} A Kubernetes ServiceAccount object.
 */
export function getServiceAccount(name: string): kind.ServiceAccount {
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
 * Generates a Kubernetes Role resource with store-specific permissions,
 * and merges custom RBAC rules from package.json.
 *
 * @param {string} name - The base name for the Role. The function appends "-store" to the name.
 * @param {PackageJson} [packageData] - Optional package.json data for extracting custom RBAC rules.
 * @returns {kind.Role} A Kubernetes Role object with store-specific permissions and merged custom rules.
 */
export function getStoreRole(name: string, packageData?: PackageJson): kind.Role {
  name = `${name}-store`;

  // Default store role rules
  const generatedRules = [
    {
      apiGroups: ["pepr.dev"],
      resources: ["peprstores"],
      resourceNames: [""],
      verbs: ["create", "get", "patch", "watch"],
    },
  ];

  // Get custom store role rules from package.json
  const customStoreRules = getCustomStoreRoleRule(packageData);

  // Merge custom rules with generated rules
  const mergedRules = mergeRBACRules(generatedRules, customStoreRules);

  return {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "Role",
    metadata: { name, namespace: "pepr-system" },
    rules: mergedRules,
  };
}

/**
 * Generates a Kubernetes RoleBinding resource that binds a Role with store-specific permissions to a ServiceAccount.
 *
 * @param {string} name - The base name for the RoleBinding. The function appends "-store" to the name.
 * @returns {kind.RoleBinding} A Kubernetes RoleBinding object with store-specific permissions.
 */
export function getStoreRoleBinding(name: string): kind.RoleBinding {
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
 * Logs the error with a specific message based on its type.
 * @param {Error} error - The error to be logged.
 */
function logError(error: Error): void {
  Log.error(`Error occurred: ${error.message}`);
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
    //Log.info(`Reading package.json from: ${packageJsonPath}`);
    //Log.info(`File content read from package.json: ${fileContent}`); // Log the raw file content
    const parsedContent = JSON.parse(fileContent);
    //Log.info(`Parsed package.json content: ${JSON.stringify(parsedContent, null, 2)}`); // Log the parsed content
    return parsedContent as PackageJson;
  } catch (error) {
    throw new Error(`Error reading or parsing package.json: ${error instanceof Error ? error.message : String(error)}`);
  }
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

    //Log.info(`Extracted RBAC configuration: ${JSON.stringify(rbacConfig, null, 2)}`);
    return validateRBACConfig(rbacConfig);
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)));
    return createEmptyRBACConfig();
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
export function getRBACConfig(peprConfig: PeprConfig): CustomRBACConfig {
  if (!peprConfig.rbac) {
    Log.info("No RBAC configuration found in package.json.");
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
    role: [],
    clusterRole: [],
  };
}

/**
 * Extracts custom rules for ClusterRoles from the custom RBAC configuration.
 * This function returns only the rules defined in the package.json, not the full ClusterRole objects.
 * @returns {object[]} An array of rules for ClusterRoles.
 */
export function getCustomClusterRoleRule(packageData?: PackageJson): object[] {
  const customClusterRoles = getCustomRBACField("clusterRole", packageData);
  //Log.info(`Custom ClusterRole rules extracted: ${JSON.stringify(customClusterRoles, null, 2)}`);

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
export function getCustomStoreRoleRule(packageData?: PackageJson): object[] {
  const customRoles = getCustomRBACField("role", packageData);
  //Log.info(`Custom Role rules extracted: ${JSON.stringify(customRoles, null, 2)}`);

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
    role: validateRoleEntries(rbacConfig.role ?? [], "roles"),
    clusterRole: validateRoleEntries(rbacConfig.clusterRole ?? [], "clusterRoles"),
  };
}

/**
 * Validates a list of role entries (either Roles or ClusterRoles).
 * Logs messages for invalid items and skips them in the result.
 * @param {V1Role[] | V1ClusterRole[]} roles - The list of roles to validate.
 * @param {string} itemName - The name of the role type being validated.
 * @returns {V1Role[] | V1ClusterRole[]} The list of valid roles.
 */
export function validateRoleEntries<T extends V1Role | V1ClusterRole>(roles: T[], itemName: string): T[] {
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
export function validateRoleItem(role: KubernetesResource, itemName: string): boolean {
  if (!role || typeof role !== "object") {
    Log.warn(`Invalid ${itemName} item: Expected an object but got ${typeof role}`);
    return false;
  }
  return true;
}

/**
 * Merges two arrays of RBAC rules. If a rule with the same apiGroup and resource exists,
 * it merges the verbs, otherwise, it adds the new rule.
 *
 * @param {Array} generatedRules - The rules generated from capabilities.
 * @param {Array} customRules - The custom rules from package.json.
 * @returns {Array} Merged array of RBAC rules.
 */
function mergeRBACRules(
  generatedRules: Array<{ apiGroups: string[]; resources: string[]; verbs: string[] }>,
  customRules: Array<{ apiGroups?: string[]; resources?: string[]; verbs?: string[] }>,
) {
  const mergedRules = [...generatedRules];

  customRules.forEach(customRule => {
    const existingRule = mergedRules.find(
      rule =>
        JSON.stringify(rule.apiGroups) === JSON.stringify(customRule.apiGroups) &&
        JSON.stringify(rule.resources) === JSON.stringify(customRule.resources),
    );

    if (existingRule) {
      // Merge verbs, avoiding duplicates
      existingRule.verbs = Array.from(new Set([...existingRule.verbs, ...(customRule.verbs || [])]));
    } else {
      // Add new custom rule if no match is found
      mergedRules.push({
        apiGroups: customRule.apiGroups || [],
        resources: customRule.resources || [],
        verbs: customRule.verbs || [],
      });
    }
  });

  return mergedRules;
}

/**
 * Creates an RBAC map from the provided capabilities, consolidating resource and verb mappings
 * based on the capability's bindings and resources.
 *
 * If the capability has no bindings, it uses the capability's own resources and verbs.
 * For each binding, it creates a key in the format `group/version/kind`, and assigns appropriate
 * verbs and resource names (plural forms).
 *
 * Additionally, it includes predefined mappings for `pepr.dev` and `apiextensions.k8s.io` groups.
 *
 * @param {CapabilityExport[]} capabilities - An array of capabilities that define API groups, resources, verbs, and bindings.
 * @returns {RBACMap} A map where the keys represent `group/version/kind` and the values contain verbs and resource plural names.
 */
export function createRBACMap(capabilities: CapabilityExport[]): RBACMap {
  return capabilities.reduce((acc: RBACMap, capability: CapabilityExport) => {
    // If no bindings, use capability's resources and verbs directly
    if (capability.bindings.length === 0) {
      const key = `${capability.apiGroups?.[0] || "defaultGroup"}/v1/${capability.resources?.[0]}`;
      acc[key] = {
        verbs: capability.verbs || [],
        plural: capability.resources?.[0] || "defaultResource",
      };
    }

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
