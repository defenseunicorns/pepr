// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import {  describe, jest } from "@jest/globals";

import { peprBuild } from "./pepr-build-wasm";


// Unmock unit test things
jest.deepUnmock("pino");


// Allow 5 minutes for the tests to run
jest.setTimeout(1000 * 60 * 5);

describe("Journey: `npx pepr build -r gchr.io/defenseunicorns --rbac-mode scoped -o dist/pepr-test-module/child/folder`", peprBuild);
