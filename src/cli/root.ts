// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Command } from "commander";

import Log from "../lib/logger";

export class RootCmd extends Command {
  // eslint-disable-next-line class-methods-use-this
  createCommand(name: string) {
    const cmd = new Command(name);

    cmd.option("-l, --log-level [level]", "Log level: debug, info, warn, error", "info");

    cmd.hook("preAction", run => {
      Log.level = run.opts().logLevel;
    });

    return cmd;
  }
}
