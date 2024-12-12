// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, afterAll, describe, jest } from "@jest/globals";

import { promises as fs } from "fs";
import { peprBuild } from "./pepr-build";
import { peprDeploy } from "./pepr-deploy";
import { peprDev } from "./pepr-dev";
import { peprFormat } from "./pepr-format";
import { peprInit } from "./pepr-init";
import { removeFolder } from "./utils";
import { outputDir } from "./pepr-build-wasm";
import { resolve } from "path";
// Unmock unit test things
jest.deepUnmock("pino");

// The working directory for the tests after `npx pepr init` is run
export const cwd = "pepr-test-module";

jest.setTimeout(1000 * 60 * 5);

// Configure the test environment before running the tests
beforeAll(async () => {
  //TODO: You'll probably want to comment this out so that you don't need to re-init every time you're testing later Journey blocks (e.g., peprDeploy)
  const dir = resolve(cwd);
  try {
    await fs.access(dir);
    await fs.rm(dir, { recursive: true, force: true });
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
      // The directory does not exist, do nothing
    }
  }
});
afterAll(async () => {
  await removeFolder(outputDir);
});
describe("Journey: `npx pepr init`", peprInit);

describe("Journey: `npx pepr format`", peprFormat);

describe("Journey: `npx pepr build`", peprBuild);

describe("Journey: `npx pepr deploy`", peprDeploy);

describe("Journey: `npx pepr dev`", peprDev);
