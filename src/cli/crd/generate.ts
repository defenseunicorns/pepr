// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// commands/crd/generate.ts
import { Command } from "commander";

const generate = new Command("generate")
  .description("Generate CRD manifests from TypeScript definitions")
  .option("--output <output>", "Output directory for generated CRDs", "./crds")
  .action(async options => {
    console.log("Generating CRDs...");
    console.log(`Output directory: ${options.output}`);
  });

export default generate;
