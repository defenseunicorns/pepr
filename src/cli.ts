#!/usr/bin/env node

// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { banner } from "./cli/banner";
import build from "./cli/build";
import deploy from "./cli/deploy";
import dev from "./cli/dev";
import format from "./cli/format";
import monitor from "./cli/monitor";
import init from "./cli/init/index";
import uuid from "./cli/uuid";
import { version } from "./cli/init/templates";
import { Command } from "commander";
import update from "./cli/update";
import kfc from "./cli/kfc";
import crd from "./cli/crd";
import featureDemo from "./cli/feature-demo";
import { featureFlagStore } from "./lib/features/store";
import Log from "./lib/telemetry/logger";

if (process.env.npm_lifecycle_event !== "npx") {
  Log.info("Pepr should be run via `npx pepr <command>` instead of `pepr <command>`.");
}

const program = new Command();
if (!process.env.PEPR_NODE_WARNINGS) {
  process.removeAllListeners("warning");
}
program
  .enablePositionalOptions()
  .version(version)
  .description(`Pepr (v${version}) - Type safe K8s middleware for humans`)
  .option("--features <features>", "Comma-separated feature flags (feature=value)")
  .hook("preAction", thisCommand => {
    try {
      featureFlagStore.initialize(thisCommand.opts().features);
    } catch (error) {
      Log.error(error, "Failed to initialize feature store:");
      process.exit(1);
    }
  })
  .addCommand(crd())
  .addCommand(init())
  .action(() => {
    if (program.args.length < 1) {
      Log.info(banner);
      program.help();
    } else {
      Log.error(`Invalid command '${program.args.join(" ")}'\n`);
      program.outputHelp();
      process.exitCode = 1;
    }
  });

build(program);
deploy(program);
dev(program);
update(program);
format(program);
monitor(program);
uuid(program);
kfc(program);
featureDemo(program);
program.parse();
