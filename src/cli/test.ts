// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import Log from "../lib/logger";
import { RootCmd } from "./root";

export default function (program: RootCmd) {
  program
    .command("test")
    .description("Test a Pepr Module locally")
    .option("-w, --watch", "Watch for changes and re-run the test")
    .action(() => {
      Log.info("Test Module");
    });
}
