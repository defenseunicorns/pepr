#!/usr/bin/env node

// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Kubernetes Fluent Client Authors

import { hideBin } from "yargs/helpers";
import yargs from "yargs/yargs";
import { GenerateOptions, generate } from "./generate";
import { version } from "../package.json";
import { postProcessing } from "./postProcessing";
import { NodeFileSystem } from "./fileSystem"; // Import your new file system

void yargs(hideBin(process.argv))
  .version("version", "Display version number", `kubernetes-fluent-client v${version}`)
  .alias("version", "V")
  .command(
    "crd [source] [directory]",
    "generate usable types from a K8s CRD",
    yargs => {
      return yargs
        .positional("source", {
          describe: "the yaml file path, remote url, or K8s CRD name",
          type: "string",
        })
        .positional("directory", {
          describe: "the directory to output the generated types to",
          type: "string",
        })
        .option("plain", {
          alias: "p",
          type: "boolean",
          description:
            "generate plain types without binding to the fluent client, automatically enabled when an alternate language is specified",
        })
        .option("language", {
          alias: "l",
          type: "string",
          default: "ts",
          description:
            "the language to generate types in, see https://github.com/glideapps/quicktype#target-languages for a list of supported languages",
        })
        .option("noPost", {
          alias: "x",
          type: "boolean",
          default: false,
          description: "disable post-processing after generating the types",
        })
        .demandOption(["source", "directory"]);
    },
    async argv => {
      const opts = argv as unknown as GenerateOptions;
      opts.logFn = console.log;

      // Pass the `post` flag to opts
      opts.noPost = argv.noPost as boolean;

      // Use NodeFileSystem as the file system for post-processing
      const fileSystem = new NodeFileSystem(); // Create an instance of NodeFileSystem

      if (!opts.noPost) {
        console.log("\n✅ Post-processing has been enabled.\n");
      }

      try {
        // Capture the results returned by generate
        const allResults = await generate(opts);

        // If noPost is false, run post-processing
        if (!opts.noPost) {
          await postProcessing(allResults, opts, fileSystem); // Pass the file system to postProcessing
        }
      } catch (e) {
        console.log(`\n❌ ${e.message}`);
      }
    },
  )
  .parse();
