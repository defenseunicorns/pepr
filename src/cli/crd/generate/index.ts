// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Command } from "commander";
import { generateCRDs } from "./generators";

export default function (): Command {
  return new Command("generate")
    .description(
      "Generate CRD manifests from TypeScript definitions stored in 'api/' of the current directory.",
    )
    .option("-o, --output <directory>", "Output directory for generated CRDs", "./crds")
    .action(options => generateCRDs(options));
}
