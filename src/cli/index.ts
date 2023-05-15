#!/usr/bin/env node

// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import packageJSON from "../../package.json" assert { type: "json" };
import { banner } from "./banner.js";
import build from "./build.js";
import deploy from "./deploy.js";
import dev from "./dev.js";
import init from "./init/index.js";
import { RootCmd } from "./root.js";
import update from "./update.js";

const program = new RootCmd();
const { version } = packageJSON;

program
  .version(version)
  .description(`Pepr Kubernetes Thingy (v${version})`)
  .action(() => {
    if (program.args.length < 1) {
      console.log(banner);
      program.help();
    }
  });

init(program);
build(program);
deploy(program);
dev(program);
update(program);

// @todo: finish/re-evaluate these commands
// test(program);
// capability(program);

program.parse();
