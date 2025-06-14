// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, afterAll, describe } from "vitest";

import { before } from "./before";
import { peprBuild } from "./pepr-build";
import { peprDeploy } from "./pepr-deploy";
import { peprDev } from "./pepr-dev";
import { peprFormat } from "./pepr-format";
import { peprInit } from "./pepr-init";
import { removeFolder } from "./utils";
import { outputDir } from "./pepr-build.helpers";

// The working directory for the tests after `npx pepr init` is run
export const cwd = "pepr-test-module";

// Configure the test environment before running the tests
beforeAll(before);
afterAll(async () => {
  await removeFolder(outputDir);
});
describe("Journey: `npx pepr init`", { timeout: 1000 * 5 * 60 }, peprInit);

describe("Journey: `npx pepr format`", { timeout: 1000 * 5 * 60 }, peprFormat);

describe("Journey: `npx pepr build`", { timeout: 1000 * 5 * 60 }, peprBuild);

describe("Journey: `npx pepr deploy`", { timeout: 1000 * 5 * 60 }, peprDeploy);

describe("Journey: `npx pepr dev`", { timeout: 1000 * 5 * 60 }, peprDev);
