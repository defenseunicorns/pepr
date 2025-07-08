// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { describe, afterAll } from "vitest";
import { peprBuild } from "./pepr-build-wasm";
import { removeFolder } from "./utils";
import { outputDir } from "./pepr-build.helpers";

afterAll(async () => {
  await removeFolder(outputDir);
});

describe(
  "Journey: `npx pepr build --registry-info gchr.io/defenseunicorns --output dist/pepr-test-module/child/folder`",
  { timeout: 1000 * 60 * 5 },
  peprBuild,
);
