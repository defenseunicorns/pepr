// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { program } from "commander";
import crypto from "crypto";
import fs from "fs";
import { gunzipSync } from "zlib";
import { version } from "../../package.json";
import Log from "../lib/logger";

program
  .version(version)
  .description(`Pepr Kubernetes Runtime (v${version})`)
  .argument("<hash>", "Hash of the module to run")
  .option("-l, --log-level [level]", "Log level: debug, info, warn, error", "info")
  .action((expectedHash: string, opts) => {
    const gzPath = `/app/load/module-${expectedHash}.js.gz`;
    const jsPath = `/app/module-${expectedHash}.js`;

    // Require the has to be 64 characters long
    if (expectedHash.length !== 64) {
      Log.error("Invalid hash");
      process.exit(1);
    }

    // Check if the path is a valid file
    if (!fs.existsSync(gzPath)) {
      Log.error(`File not found: ${gzPath}`);
      process.exit(1);
    }

    // Set the log level
    Log.SetLogLevel(opts.logLevel);

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
      // @todo: evaluate vm (isolate) vs require
      require(jsPath);
    } catch (e) {
      Log.error(`Failed to decompress module: ${e}`);
      process.exit(1);
    }
  });

program.parse();
