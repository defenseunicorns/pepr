// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Command } from "commander";
import { createDirectoryIfNotExists } from "../../lib/filesystemService";
import { promises as fs } from "fs";
import path from "path";

// Scaffolds a new CRD TypeScript definition
const create = new Command("create")
  .description("Create a new CRD TypeScript definition")
  .requiredOption("--group <group>", "API group (e.g. cache)")
  .requiredOption("--version <version>", "API version (e.g. v1alpha1)")
  .requiredOption("--kind <kind>", "Kind name (e.g. Memcached)")
  .option("--domain <domain>", "Optional domain (e.g. pepr.dev)", "pepr.dev")
  .action(async ({ group, version, kind, domain }) => {
    console.log("Creating CRD with:", { group, version, kind, domain });

    const outputDir = path.resolve(`./api/${version}`);
    await createDirectoryIfNotExists(outputDir);

    // create file in directory with kind
    await fs.writeFile(
      `./api/${version}/${kind.toLowerCase()}_types.ts`,
      generateCRDScaffold(group, version, kind, domain),
    );
  });

export default create;

export const generateCRDScaffold = (
  group: string,
  version: string,
  kind: string,
  domain: string,
): string => {
  return `// Auto-generated CRD TypeScript definition
// Kind: ${kind}
// Group: ${group}
// Version: ${version}
// Domain: ${domain}

import { V1Condition } from "@kubernetes/client-node";

export interface ${kind}Spec {
	// INSERT ADDITIONAL SPEC FIELDS - desired state of cluster
	// Important: Run "npx pepr crd generate" to regenerate code after modifying this file

	// Size defines the number of ${kind} instances
	Size?: number;

	// Port defines the port that will be used to init the container with the image
	ContainerPort: number; 
}

export interface ${kind}Status {
  conditions?: V1Condition[];
}
`;
};
