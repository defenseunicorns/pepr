// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import anyTest from "ava";

import { before } from "./before";
import { peprBuild } from "./pepr-build";
import { peprDeploy } from "./pepr-deploy";
import { peprDev } from "./pepr-dev";
import { peprFormat } from "./pepr-format";
import { peprInit } from "./pepr-init";

// The working directory for the tests after `npx pepr init` is run
export const cwd = "pepr-test-module";

// Journey tests must be run serially
const test = anyTest.serial;

// Configure the test environment before running the tests
test.before(before);

test("Journey: `npx pepr init`", peprInit);

test("Journey: `npx pepr format`", peprFormat);

test("Journey: `npx pepr build`", peprBuild);

test("Journey: `pepr deploy`", peprDeploy);

test("Journey: `pepr dev`", peprDev);
