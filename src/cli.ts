#!/usr/bin/env node

// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { banner } from "./cli/banner";
import build from "./cli/build";
import deploy from "./cli/deploy";
import dev from "./cli/dev";
import format from "./cli/format";
import init from "./cli/init/index";
import { version } from "./cli/init/templates";
import { RootCmd } from "./cli/root";
import update from "./cli/update";
import { Log } from "./lib";

if (process.env.npm_lifecycle_event !== "npx") {
  Log.error(
    "Pepr should be run via `npx pepr <command>` instead of `pepr <command>`.",
    "npx required",
  );
  process.exit(1);
}

const program = new RootCmd();

program
  .version(version)
  .description(`Pepr (v${version}) - Type safe K8s middleware for humans`)
  .action(() => {
    if (program.args.length < 1) {
      console.log(banner);
      program.help();
    } else {
      Log.error(`Invalid command '${program.args.join(" ")}'\n`);
      program.outputHelp();
      process.exitCode = 1;
    }
  });

init(program);
build(program);
deploy(program);
dev(program);
update(program);
format(program);

// @todo: finish/re-evaluate these commands
// test(program);
// capability(program);

program.parse();
