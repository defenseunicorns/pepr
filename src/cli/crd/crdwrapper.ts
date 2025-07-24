// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Command } from "commander";
import crd from ".";

export default function (program: Command): void {
  program.addCommand(crd());
}
