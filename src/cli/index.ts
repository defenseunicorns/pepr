// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { program } from "commander";
import { version } from "../../package.json";

program.version(version);

program
  .command("init")
  .description("Initialize a new Pepr Module")
  .action(() => {
    // TODO: Initialize a new module
    console.log("init");
  });

program
  .command("build")
  .description("Build a Pepr Module")
  .action(() => {
    // TODO: Build a module
    console.log("build");
  });

program
  .command("new")
  .description("Create a new Pepr Capability")
  .action(() => {
    // TODO: Create a new capability
    console.log("new");
  });

program.parse();
