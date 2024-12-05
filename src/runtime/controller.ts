#!/usr/bin/env node

// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { fork } from "child_process";
import crypto from "crypto";
import fs from "fs";
import { gunzipSync } from "zlib";
import { K8s, kind } from "kubernetes-fluent-client";
import Log from "../lib/telemetry/logger";
import { packageJSON } from "../templates/data.json";
import { peprStoreCRD } from "../lib/assets/store";
import { validateHash } from "../lib/helpers";
const { version } = packageJSON;

function runModule(expectedHash: string) {
  const gzPath = `/app/load/module-${expectedHash}.js.gz`;
  const jsPath = `/app/module-${expectedHash}.js`;

  // Set the log level
  Log.level = "info";

  // Check if the path is a valid file
  if (!fs.existsSync(gzPath)) {
    throw new Error(`File not found: ${gzPath}`);
  }

  try {
    Log.info(`Loading module ${gzPath}`);

    // Extract the code from the file
    const codeGZ = fs.readFileSync(gzPath);
    const code = gunzipSync(codeGZ);

    // Get the hash of the extracted code
    const actualHash = crypto.createHash("sha256").update(code).digest("hex");

    // If the hash doesn't match, exit
    // This is a timing safe comparison to prevent timing attacks
    // https://en.wikipedia.org/wiki/Timing_attack
    if (!crypto.timingSafeEqual(Buffer.from(expectedHash, "hex"), Buffer.from(actualHash, "hex"))) {
      throw new Error(`File hash does not match, expected ${expectedHash} but got ${actualHash}`);
    }

    Log.info(`File hash matches, running module`);

    // Write the code to a file
    fs.writeFileSync(jsPath, code);

    // Run the module
    fork(jsPath);
  } catch (e) {
    throw new Error(`Failed to decompress module: ${e}`);
  }
}

Log.info(`Pepr Controller (v${version})`);

const hash = process.argv[2];

const startup = async () => {
  try {
    Log.info("Applying the Pepr Store CRD if it doesn't exist");
    await K8s(kind.CustomResourceDefinition).Apply(peprStoreCRD, { force: true });

    validateHash(hash);
    runModule(hash);
  } catch (err) {
    Log.error(err, `Error starting Pepr Store CRD`);
    process.exit(1);
  }
};

startup().catch(err => Log.error(err, `Error starting Pepr Controller`));
