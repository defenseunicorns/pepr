// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, describe, expect, it } from "@jest/globals";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { Workdir } from "../helpers/workdir";
import * as time from "../helpers/time";
import * as pepr from "../helpers/pepr";
import * as resource from "../helpers/resource";

const FILE = path.basename(__filename);
const HERE = __dirname;

describe("build", () => {
  const workdir = new Workdir(`${FILE}`, `${HERE}/../testroot/cli`);

  beforeAll(async () => {
    await workdir.recreate();
  }, time.toMs("60s"));

  describe("builds a module", () => {
    const id = FILE.split(".").at(1);
    const testModule = `${workdir.path()}/${id}`;

    beforeAll(async () => {
      await fs.rm(testModule, { recursive: true, force: true });
      const argz = [
        `--name ${id}`,
        `--description ${id}`,
        `--errorBehavior reject`,
        "--confirm",
        "--skip-post-init",
      ].join(" ");
      await pepr.cli(workdir.path(), { cmd: `pepr init ${argz}` });
      await pepr.tgzifyModule(testModule);
      await pepr.cli(testModule, { cmd: `npm install` });
    }, time.toMs("2m"));

    describe("for use as a library", () => {
      let packageJson;
      let uuid: string;

      it(
        "builds",
        async () => {
          const argz = [`--no-embed`].join(" ");
          const build = await pepr.cli(testModule, { cmd: `pepr build ${argz}` });
          expect(build.exitcode).toBe(0);
          expect(build.stderr.join("").trim()).toContain("");
          expect(build.stdout.join("").trim()).toContain("Module built successfully at");

          packageJson = await resource.fromFile(`${testModule}/package.json`);
          uuid = packageJson.pepr.uuid;
        },
        time.toMs("1m"),
      );

      it(
        "outputs appropriate configuration",
        async () => {
          const missing = [
            `${testModule}/dist/pepr-${uuid}.js`,
            `${testModule}/dist/pepr-${uuid}.js.map`,
            `${testModule}/dist/pepr-${uuid}.js.LEGAL.txt`,
            `${testModule}/dist/pepr-module-${uuid}.yaml`,
            `${testModule}/dist/zarf.yaml`,
            `${testModule}/dist/${uuid}-chart/`,
          ];
          for (const path of missing) {
            expect(existsSync(path)).toBe(false);
          }

          const found = [
            `${testModule}/dist/pepr.js`,
            `${testModule}/dist/pepr.js.map`,
            `${testModule}/dist/pepr.js.LEGAL.txt`,
          ];
          for (const path of found) {
            expect(existsSync(path)).toBe(true);
          }
        },
        time.toMs("1m"),
      );
    });
  });
});
