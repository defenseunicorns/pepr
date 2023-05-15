// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { RootCmd } from "./root.js";

export default function (program: RootCmd) {
  program
    .command("new")
    .description("Create a new Pepr Capability")
    .action(() => {
      // TODO: Create a new capability
      console.log("new");
    });
}
