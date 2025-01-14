// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, describe, expect, it } from "@jest/globals";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { Workdir } from "../helpers/workdir";
import * as time from "../helpers/time";
import * as pepr from "../helpers/pepr";
import * as resource from "../helpers/resource";
import * as file from "../helpers/file";

const FILE = path.basename(__filename);
const HERE = __dirname;

describe("build", () => {
  const workdir = new Workdir(`${FILE}`, `${HERE}/../testroot/cli`);

  beforeAll(async () => {
    await workdir.recreate();
  });

  describe("builds a module", () => {
    const id = FILE.split(".").at(1);
    const mod = `${workdir.path()}/${id}`;

    beforeAll(async () => {
      await fs.rm(mod, { recursive: true, force: true });
      const argz = [
        `--name ${id}`,
        `--description ${id}`,
        `--errorBehavior reject`,
        "--confirm",
        "--skip-post-init",
      ].join(" ");
      await pepr.cli(workdir.path(), { cmd: `pepr init ${argz}` });
      await pepr.tgzifyModule(mod);
      await pepr.cli(mod, { cmd: `npm install` });
    }, time.toMs("2m"));

    describe("for use as a library", () => {
      let packageJson;
      let uuid: string;

      it(
        "builds",
        async () => {
          const argz = [`--no-embed`].join(" ");
          const build = await pepr.cli(mod, { cmd: `pepr build ${argz}` });
          expect(build.exitcode).toBe(0);

          // TODO: team talk
          // Should this be writing to stderr? Even with a 0 exit code..?
          expect(build.stderr.join("").trim()).toContain("Error: Cannot find module");
          // TODO: end

          expect(build.stdout.join("").trim()).toContain("");

          packageJson = await resource.oneFromFile(`${mod}/package.json`);
          uuid = packageJson.pepr.uuid;
        },
        time.toMs("1m"),
      );

      it(
        "outputs appropriate configuration",
        async () => {
          const missing = [
            `${mod}/dist/pepr-${uuid}.js`,
            `${mod}/dist/pepr-${uuid}.js.map`,
            `${mod}/dist/pepr-${uuid}.js.LEGAL.txt`,
            `${mod}/dist/pepr-module-${uuid}.yaml`,
            `${mod}/dist/zarf.yaml`,
            `${mod}/dist/${uuid}-chart/`,
          ];
          for (const path of missing) {
            expect(await file.exists(path)).toBe(false);
          }

          const found = [
            `${mod}/dist/pepr.js`,
            `${mod}/dist/pepr.js.map`,
            `${mod}/dist/pepr.js.LEGAL.txt`,
          ];
          for (const path of found) {
            expect(await file.exists(path)).toBe(true);
          }
        },
        time.toMs("1m"),
      );
    });
  });
});
