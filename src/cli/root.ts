// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Command } from "commander";

export class RootCmd extends Command {
  // eslint-disable-next-line class-methods-use-this
  createCommand(name: string): Command {
    const cmd = new Command(name);
    return cmd;
  }
}
