// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Command } from "commander";
import generate from "./generate/";
import create from "./create";

export default function (): Command {
  return new Command("crd")
    .description("Scaffold and generate Kubernetes CRDs from structured TypeScript definitions")
    .addCommand(create())
    .addCommand(generate());
}
