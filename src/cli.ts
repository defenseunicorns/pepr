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

const program = new RootCmd();

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
format(program);

// @todo: finish/re-evaluate these commands
// test(program);
// capability(program);

program.parse();
