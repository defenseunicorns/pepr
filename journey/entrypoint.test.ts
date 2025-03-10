// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, afterAll, describe, jest } from "@jest/globals";

import { before } from "./before";
import { peprBuild } from "./pepr-build";
import { peprDeploy } from "./pepr-deploy";
import { peprDev } from "./pepr-dev";
import { peprFormat } from "./pepr-format";
import { peprInit } from "./pepr-init";
import { removeFolder } from "./utils";
import { outputDir } from "./pepr-build.helpers";
// Unmock unit test things
jest.deepUnmock("pino");

// The working directory for the tests after `npx pepr init` is run
export const cwd = "pepr-test-module";

jest.setTimeout(1000 * 60 * 5);

// Configure the test environment before running the tests
beforeAll(before);
afterAll(async () => {
  await removeFolder(outputDir);
});
describe("Journey: `npx pepr init`", peprInit);

describe("Journey: `npx pepr format`", peprFormat);

describe("Journey: `npx pepr build`", peprBuild);

describe("Journey: `npx pepr deploy`", peprDeploy);

describe("Journey: `npx pepr dev`", peprDev);
