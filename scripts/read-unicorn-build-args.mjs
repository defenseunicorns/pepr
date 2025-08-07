// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { readFileSync } from "fs";

try {
  const dockerfileContent = readFileSync("./config/Dockerfile", "utf8");
  const fromStatements = dockerfileContent.match(/^FROM\s+([^\s]+)\s+/gm);

  if (!fromStatements || fromStatements.length < 2) {
    console.error("Error: Could not find two FROM statements in the Dockerfile.");
    process.exit(1);
  }

  const buildImage = fromStatements[0].split(" ")[1].trim();
  const baseImage = fromStatements[1].split(" ")[1].trim();

  console.log("--build-arg");
  console.log(`BUILD_IMAGE=${buildImage}`);
  console.log("--build-arg");
  console.log(`BASE_IMAGE=${baseImage}`);
  console.log("--build-arg");
  console.log(`REQUIRE_CHOWN=false`);
} catch (error) {
  console.error("Error reading or parsing the Dockerfile:", error);
  process.exit(1);
}
