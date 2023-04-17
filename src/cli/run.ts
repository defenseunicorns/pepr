// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import fs from "fs";
import { gunzipSync } from "zlib";
import { version } from "../../package.json";
import Log from "../lib/logger";
import { RootCmd } from "./root";

const program = new RootCmd();

program
  .version(version)
  .description(`Pepr Kubernetes Runtime (v${version})`)
  .argument("<path>", "Path to the Pepr Module to run")
  .action((path: string) => {
    // Check if the path has a .gz extension
    if (!path.endsWith(".gz")) {
      Log.error(`File is not a gzipped file: ${path}`);
      process.exit(1);
    }

    // Check if the path is a valid file
    if (!fs.existsSync(path)) {
      Log.error(`File not found: ${path}`);
      process.exit(1);
    }

    try {
      // Gunzip the file
      const compressedData = fs.readFileSync(path);
      const decompressedData = gunzipSync(compressedData);
      fs.writeFileSync(path.slice(0, -3), decompressedData);

      Log.info(`Decompressed module to pepr-module.js`);
    } catch (e) {
      Log.error(`Failed to decompress module: ${e}`);
      process.exit(1);
    }
  });

program.parse();
