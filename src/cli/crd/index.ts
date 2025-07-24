// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Command } from "commander";
import createCmd from "./create/create";
import generateCmd from "./generate";

export default function (program: Command): void {
  const crd = program
    .command("crd")
    .description("Scaffold and generate Kubernetes CRDs from structured TypeScript definitions");

  crd.addCommand(createCmd);
  crd.addCommand(generateCmd);
}
