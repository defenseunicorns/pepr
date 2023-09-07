#!/usr/bin/env node

// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { fork } from "child_process";
import crypto from "crypto";
import fs from "fs";
import { gunzipSync } from "zlib";

import Log from "../lib/logger";
import { packageJSON } from "../templates/data.json";

const { version } = packageJSON;

function validateHash(expectedHash: string) {
  // Require the hash to be 64 characters long
  if (!expectedHash || expectedHash.length !== 64) {
    Log.error("Invalid hash");
    process.exit(1);
  }
}

function runModule(expectedHash: string) {
  const gzPath = `/app/load/module-${expectedHash}.js.gz`;
  const jsPath = `/app/module-${expectedHash}.js`;

  // Set the log level
  Log.level = "info";

  // Check if the path is a valid file
  if (!fs.existsSync(gzPath)) {
    Log.error(`File not found: ${gzPath}`);
    process.exit(1);
  }

  try {
    Log.info(`Loading module ${gzPath}`);

    // Extract the code from the file
    const codeGZ = fs.readFileSync(gzPath);
    const code = gunzipSync(codeGZ);

    // Get the hash of the extracted code
    const actualHash = crypto.createHash("sha256").update(code).digest("hex");

    // If the hash doesn't match, exit
    if (expectedHash !== actualHash) {
      Log.error(`File hash does not match, expected ${expectedHash} but got ${actualHash}`);
      process.exit(1);
    }

    Log.info(`File hash matches, running module`);

    // Write the code to a file
    fs.writeFileSync(jsPath, code);

    // Run the module
    fork(jsPath);
  } catch (e) {
    Log.error(`Failed to decompress module: ${e}`);
    process.exit(1);
  }
}

Log.info(`Pepr Controller (v${version})`);

const hash = process.argv[2];

validateHash(hash);
runModule(hash);
