// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, describe, jest } from "@jest/globals";
import { promises as fs } from "fs";
import { peprBuild } from "./pepr-build-wasm";
import { resolve } from "path";
import { cwd } from "./entrypoint.test";

// Unmock unit test things
jest.deepUnmock("pino");

// Allow 5 minutes for the tests to run
jest.setTimeout(1000 * 60 * 5);
export const outputDir = "dist/pepr-test-module/child/folder";
beforeAll(async () => {
  await fs.mkdir(outputDir, { recursive: true });
  await addScopedRbacMode();
});
describe(
  "Journey: `npx pepr build -r gchr.io/defenseunicorns -o dist/pepr-test-module/child/folder`",
  peprBuild,
);

// Set rbacMode in the Pepr Module Config and write it back to disk
async function addScopedRbacMode() {
  const packageJson = await fs.readFile(resolve(cwd, "package.json"), "utf8");
  const packageJsonObj = JSON.parse(packageJson);
  console.log(JSON.stringify(packageJsonObj.pepr));
  packageJsonObj.pepr.rbacMode = "scoped";
  await fs.writeFile(resolve(cwd, "package.json"), JSON.stringify(packageJsonObj, null, 2));
}
