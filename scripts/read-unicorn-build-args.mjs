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

  // Don't quote the values since they're quoted in the Dockerfile
  console.log(`--build-arg BUILD_IMAGE=${buildImage} --build-arg BASE_IMAGE=${baseImage}`);
} catch (error) {
  console.error("Error reading or parsing the Dockerfile:", error);
  process.exit(1);
}
