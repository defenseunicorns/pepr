// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { RootCmd } from "./root";

export default function (program: RootCmd) {
  program
    .command("init")
    .description("Initialize a new Pepr Module")
    .action(() => {
      // TODO: Initialize a new module
      console.log("init");
    });
}
