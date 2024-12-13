// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { promises as fs } from "fs";

export async function createDockerfile(version: string, description: string, includedFiles: string[]): Promise<void> {
  const file = `
    # Use an official Node.js runtime as the base image
    FROM ghcr.io/defenseunicorns/pepr/controller:v${version}
  
    LABEL description="${description}"
    
    # Add the included files to the image
    ${includedFiles.map(f => `ADD ${f} ${f}`).join("\n")}
  
    `;

  await fs.writeFile("Dockerfile.controller", file, { encoding: "utf-8" });
}
