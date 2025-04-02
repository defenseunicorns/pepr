// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { RootCmd } from "../root";
import createCmd from "./create";
import generateCmd from "./generate";

export default function (program: RootCmd): void {
  const crd = program
    .command("crd")
    .description("Scaffold and generate Kubernetes CRDs from structured TypeScript definitions");

  crd.addCommand(createCmd);
  crd.addCommand(generateCmd);
}
