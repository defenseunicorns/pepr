// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Command } from "commander";

const create = new Command("create")
  .description("Create a new CRD TypeScript definition")
  .requiredOption("--group <group>", "API group (e.g. cache)")
  .requiredOption("--version <version>", "API version (e.g. v1alpha1)")
  .requiredOption("--kind <kind>", "Kind name (e.g. Memcached)")
  .option("--domain <domain>", "Optional domain (e.g. pepr.dev)", "pepr.dev")
  .action(async options => {
    console.log("Creating CRD with:", options);
  });

export default create;
