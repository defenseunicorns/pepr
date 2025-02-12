// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { createDockerfile } from "./included-files";
import { expect, describe, it } from "@jest/globals";
import { promises as fs } from "fs";

describe("createDockerfile", () => {
  const version = "0.0.1";
  const description = "Pepr supports WASM modules!";
  const includedFiles = ["main.wasm", "wasm_exec.js"];
  it("should create a Dockerfile.controller with the correct content", async () => {
    await createDockerfile(version, description, includedFiles);

    const generatedContent = await fs.readFile("Dockerfile.controller", "utf-8");
    expect(generatedContent).toContain(`FROM ghcr.io/defenseunicorns/pepr/controller:v${version}`);
    expect(generatedContent).toContain(`LABEL description="${description}"`);
    includedFiles.forEach(file => {
      expect(generatedContent).toContain(`ADD ${file} ${file}`);
    });
  });
});
