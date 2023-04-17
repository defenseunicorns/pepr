// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { version } from "../../package.json";
import { banner } from "./banner";
import build from "./build";
import deploy from "./deploy";
import dev from "./dev";
import init from "./init";
import { RootCmd } from "./root";
import update from "./update";

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

// @todo: finish/re-evaluate these commands
// test(program);
// capability(program);

program.parse();
