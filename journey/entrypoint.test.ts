// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, describe, jest } from "@jest/globals";

import { before } from "./before";
import { peprBuild } from "./pepr-build";
import { peprDeploy } from "./pepr-deploy";
import { peprDev } from "./pepr-dev";
import { peprFormat } from "./pepr-format";
import { peprInit } from "./pepr-init";

// Unmock unit test things
jest.deepUnmock("@kubernetes/client-node");
jest.deepUnmock("pino");

// The working directory for the tests after `npx pepr init` is run
export const cwd = "pepr-test-module";

// Allow 5 minutes for the tests to run
jest.setTimeout(1000 * 60 * 5);

// Configure the test environment before running the tests
beforeAll(before);

describe("Journey: `npx pepr init`", peprInit);

describe("Journey: `npx pepr format`", peprFormat);

describe("Journey: `npx pepr build`", peprBuild);

describe("Journey: `pepr deploy`", peprDeploy);

describe("Journey: `pepr dev`", peprDev);
