// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, describe, expect, it } from "@jest/globals";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { Workdir } from "../helpers/workdir";
import * as time from "../helpers/time";
import * as pepr from "../helpers/pepr";
import { Result } from "../helpers/cmd";

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
    let buildOutput: Result;

    beforeAll(async () => {
      await fs.rm(testModule, { recursive: true, force: true });
      const initArgs = [
        `--name ${id}`,
        `--description ${id}`,
        `--errorBehavior reject`,
        "--confirm",
        "--skip-post-init",
      ].join(" ");
      await pepr.cli(workdir.path(), { cmd: `pepr init ${initArgs}` });
      await pepr.tgzifyModule(testModule);
      await pepr.cli(testModule, { cmd: `npm install` });

      const buildArgs = [`--no-embed`].join(" ");
      buildOutput = await pepr.cli(testModule, { cmd: `pepr build ${buildArgs}` });
    }, time.toMs("3m"));

    it("should execute 'pepr build'", () => {
      expect(buildOutput.exitcode).toBe(0);
      expect(buildOutput.stderr.join("").trim()).toContain("");
      expect(buildOutput.stdout.join("").trim()).toContain("Module built successfully at");
    });

    describe("for use as a library", () => {
      it.each([[`pepr.d.ts.map`], [`pepr.d.ts`], [`pepr.js.map`], [`pepr.js`]])(
        "should create: '%s'",
        filename => {
          expect(existsSync(`${testModule}/dist/${filename}`)).toBe(true);
        },
      );

      const uuidPattern = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

      it.each([
        { filename: new RegExp(`^${uuidPattern}-chart/$`) },
        { filename: new RegExp(`^pepr-${uuidPattern}\\.js\\.map$`) },
        { filename: new RegExp(`^pepr-${uuidPattern}\\.js$`) },
        { filename: new RegExp(`^pepr-module-${uuidPattern}\\.yaml$`) },
        { filename: /^zarf\.yaml$/ },
        // Legal files are omitted when empty, see esbuild/#3670 https://github.com/evanw/esbuild/blob/main/CHANGELOG.md#0250
        { filename: new RegExp(`^pepr-${uuidPattern}\\.js\\.LEGAL\\.txt$`) },
        { filename: /^pepr\.js\.LEGAL\.txt$/ },
      ])("should not create: '$filename'", ({ filename }) => {
        const files = readdirSync(`${testModule}/dist/`);

        const matchingFiles = files.filter(file => filename.test(file));

        expect(matchingFiles.length).toBe(0);
      });
    });
  });
});
