// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, describe, expect, it } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { existsSync } from "node:fs";
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

  describe("when building with auto-detection (type: module)", () => {
    const id = `${FILE.split(".").at(1)}-auto`;
    const testModule = `${workdir.path()}/${id}`;
    let buildOutput: Result;

    beforeAll(async () => {
      await fs.rm(testModule, { recursive: true, force: true });
      const initArgs = [
        `--name ${id}`,
        `--description ${id}`,
        `--error-behavior reject`,
        `--uuid esm-test-auto`,
        "--yes",
        "--skip-post-init",
      ].join(" ");
      await pepr.cli(workdir.path(), { cmd: `pepr init ${initArgs}` });
      await pepr.tgzifyModule(testModule);

      // Modify package.json to add "type": "module"
      const packageJsonPath = `${testModule}/package.json`;
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));
      packageJson.type = "module";
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

      await pepr.cli(testModule, { cmd: `npm install` });

      const buildArgs = [`--no-embed`].join(" ");
      buildOutput = await pepr.cli(testModule, { cmd: `pepr build ${buildArgs}` });
    }, time.toMs("3m"));

    it("should execute 'pepr build' successfully with auto-detected ESM", () => {
      expect(buildOutput.exitcode).toBe(0);
      expect(buildOutput.stdout.join("").trim()).toContain("Module built successfully at");
    });

    describe("for use as an ESM library (auto-detected)", () => {
      it.each([[`pepr.d.ts.map`], [`pepr.d.ts`], [`pepr.mjs.map`], [`pepr.mjs`]])(
        "should create: '%s'",
        filename => {
          expect(existsSync(`${testModule}/dist/${filename}`)).toBe(true);
        },
      );

      it("should not create CJS output files", () => {
        expect(existsSync(`${testModule}/dist/pepr.js`)).toBe(false);
      });

      it("should use ESM syntax in the output file", async () => {
        const content = await fs.readFile(`${testModule}/dist/pepr.mjs`, "utf-8");
        // ESM uses import/export, not require
        expect(content).not.toContain("require(");
        expect(content).not.toContain("module.exports");
      });
    });
  });
});
