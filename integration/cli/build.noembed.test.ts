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

  describe("when building a module", () => {
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

    it(
      "should execute 'pepr build'",
      async () => {
        const argz = [`--no-embed`].join(" ");
        const build = await pepr.cli(testModule, { cmd: `pepr build ${argz}` });
        expect(build.exitcode).toBe(0);
        expect(build.stderr.join("").trim()).toContain("");
        expect(build.stdout.join("").trim()).toContain("Module built successfully at");
      },
      time.toMs("1m"),
    );

    describe("for use as a library", () => {
      const packageJson = resource.fromFile(`${testModule}/package.json`);
      const uuid = packageJson.pepr.uuid;

      it.each([[`pepr.d.ts.map`], [`pepr.d.ts`], [`pepr.js.map`], [`pepr.js`]])(
        "should create configuration file: '%s'",
        filename => {
          expect(existsSync(`${testModule}/dist/${filename}`)).toBe(true);
        },
      );

      it.each([
        { filename: `${uuid}-chart/` },
        { filename: `pepr-${uuid}.js.map` },
        { filename: `pepr-${uuid}.js` },
        { filename: `pepr-module-${uuid}.yaml` },
        { filename: `zarf.yaml` },
      ])("should not create configuration file: '$filename'", input => {
        expect(existsSync(`${testModule}/dist/${input.filename}`)).toBe(false);
      });

      it.each([{ filename: `pepr-${uuid}.js.LEGAL.txt` }, { filename: `pepr.js.LEGAL.txt` }])(
        "should not create legal file: '$filename'",
        input => {
          // Omitted when empty, see esbuild/#3670 https://github.com/evanw/esbuild/blob/main/CHANGELOG.md#0250
          expect(existsSync(`${testModule}/dist/${input.filename}`)).toBe(false);
        },
      );
    });
  });
});
