#!/usr/bin/env node
"use strict";
// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Kubernetes Fluent Client Authors
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const helpers_1 = require("yargs/helpers");
const yargs_1 = __importDefault(require("yargs/yargs"));
const generate_1 = require("./generate");
const package_json_1 = require("../package.json");
const postProcessing_1 = require("./postProcessing");
const fileSystem_1 = require("./fileSystem"); // Import your new file system
void (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
    .version("version", "Display version number", `kubernetes-fluent-client v${package_json_1.version}`)
    .alias("version", "V")
    .command("crd [source] [directory]", "generate usable types from a K8s CRD", yargs => {
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
        description: "generate plain types without binding to the fluent client, automatically enabled when an alternate language is specified",
    })
        .option("language", {
        alias: "l",
        type: "string",
        default: "ts",
        description: "the language to generate types in, see https://github.com/glideapps/quicktype#target-languages for a list of supported languages",
    })
        .option("noPost", {
        alias: "x",
        type: "boolean",
        default: false,
        description: "disable post-processing after generating the types",
    })
        .demandOption(["source", "directory"]);
}, async (argv) => {
    const opts = argv;
    opts.logFn = console.log;
    // Pass the `post` flag to opts
    opts.noPost = argv.noPost;
    // Use NodeFileSystem as the file system for post-processing
    const fileSystem = new fileSystem_1.NodeFileSystem(); // Create an instance of NodeFileSystem
    if (!opts.noPost) {
        console.log("\n✅ Post-processing has been enabled.\n");
    }
    try {
        // Capture the results returned by generate
        const allResults = await (0, generate_1.generate)(opts);
        // If noPost is false, run post-processing
        if (!opts.noPost) {
            await (0, postProcessing_1.postProcessing)(allResults, opts, fileSystem); // Pass the file system to postProcessing
        }
    }
    catch (e) {
        console.log(`\n❌ ${e.message}`);
    }
})
    .parse();
