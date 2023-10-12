// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { createDockerfile } from "./build";
import { expect, describe, test, jest } from "@jest/globals";
import { promises as fs } from "fs";

describe("createDockerfile", () => {
  const version = "0.0.1";
  const description = "Pepr supports WASM modules!";
  const includedFiles = ["main.wasm", "wasm_exec.js"];

  const expectedDockerfile = `
  # Use an official Node.js runtime as the base image
  FROM ghcr.io/defenseunicorns/pepr/controller:v${version}

  LABEL description="${description}"
  
  # Add the included files to the image
  ADD main.wasm main.wasm
  ADD wasm_exec.js wasm_exec.js

  `;

  jest.isolateModules(() => {
    jest.spyOn(fs, "writeFile").mockReturnValue(Promise.resolve());
    jest.spyOn(fs, "readFile").mockReturnValue(Promise.resolve(expectedDockerfile));
  });

  test("should create a Dockerfile.controller with the correct content", async () => {
    await createDockerfile(version, description, includedFiles);

    const generatedContent = await fs.readFile("Dockerfile.controller", "utf-8");
    expect(generatedContent).toContain(`FROM ghcr.io/defenseunicorns/pepr/controller:v${version}`);
    expect(generatedContent).toContain(`LABEL description="${description}"`);
    includedFiles.forEach(file => {
      expect(generatedContent).toContain(`ADD ${file} ${file}`);
    });
  });
});
