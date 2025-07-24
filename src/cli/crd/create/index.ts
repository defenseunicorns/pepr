// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Command, Option } from "commander";
import { createDirectoryIfNotExists } from "../../../lib/filesystemService";
import { promises as fs } from "fs";
import Log from "../../../lib/telemetry/logger";
import { createCRDscaffold } from "./createCRDscaffold";

// Scaffolds a new CRD TypeScript definition
export default function (): Command {
  return new Command("create")
    .description("Create a new CRD TypeScript definition")
    .addOption(
      new Option(
        "-S, --scope <scope>",
        "Whether the resulting custom resource is cluster- or namespace-scoped",
      )
        .choices(["Namespaced", "Cluster"])
        .default("Namespaced"),
    )
    .option("-d, --domain <domain>", "Optional domain for CRD (e.g. pepr.dev)", "pepr.dev")
    .requiredOption("-g, --group <group>", "API group (e.g. cache)")
    .requiredOption("-k, --kind <kind>", "Kind name (e.g. memcached)")
    .option("-p, --plural <plural>", "Plural name for CRD (e.g. memcacheds)")
    .requiredOption("-s, --short-name <name>", "Short name for CRD (e.g. mc)")
    .requiredOption("-v, --version <version>", "API version (e.g. v1alpha1)")
    .action(async ({ group, version, kind, domain, scope, plural, shortName }) => {
      Log.warn("This feature is currently in alpha.");
      // const outputDir = path.resolve(`./api/${version}`);
      await createDirectoryIfNotExists(`./api/${version}`);

      // create file in directory with kind
      await fs.writeFile(
        `./api/${version}/${kind.toLowerCase()}_types.ts`,
        createCRDscaffold(group, version, kind, { domain, scope, plural, shortName }),
      );
      Log.info(`✔ Created ${kind} TypeScript definition in ./api/${version}`);
    });
}
