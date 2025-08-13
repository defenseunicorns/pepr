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

if (process.env.npm_lifecycle_event !== "npx") {
  console.info("Pepr should be run via `npx pepr <command>` instead of `pepr <command>`.");
}

const program = new Command();
if (!process.env.PEPR_NODE_WARNINGS) {
  process.removeAllListeners("warning");
}
program
  .enablePositionalOptions()
  .version(version)
  .description(`Pepr (v${version}) - Type safe K8s middleware for humans`)
  .addCommand(crd())
  .addCommand(init())
  .action(() => {
    if (program.args.length < 1) {
      console.log(banner);
      program.help();
    } else {
      console.error(`Invalid command '${program.args.join(" ")}'\n`);
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
program.parse();
