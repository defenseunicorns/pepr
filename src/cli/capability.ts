// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { RootCmd } from "./root";

export default function (program: RootCmd) {
  program
    .command("new")
    .description("Create a new Pepr Capability")
    .option("-d, --dir [directory]", "Pepr module directory", ".")
    .action(() => {
      // TODO: Create a new capability
      console.log("new");
    });
}
