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

// Create a new instance of RootCmd
const program = new RootCmd();

// Set the version and description of the program
program
  .version(version)
  .description(`Pepr Kubernetes Thingy (v${version})`);

// Add a check for empty arguments and display the banner and help if no arguments are provided
program.action(() => {
  if (program.args.length < 1) {
    console.log(banner);
    program.help();
  }
});

// Add commands to the program
init(program);
build(program);
deploy(program);
dev(program);
update(program);

// Parse the program arguments
program.parse();

// @todo: finish/re-evaluate these commands
// test(program);
// capability(program);