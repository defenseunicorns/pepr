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

  describe("when building embedded with type: module", () => {
    const id = `${FILE.split(".").at(1)}-embed`;
    const testModule = `${workdir.path()}/${id}`;
    let buildOutput: Result;

    beforeAll(async () => {
      await fs.rm(testModule, { recursive: true, force: true });
      const initArgs = [
        `--name ${id}`,
        `--description ${id}`,
        `--error-behavior reject`,
        `--uuid esm-embed-test`,
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
      buildOutput = await pepr.cli(testModule, { cmd: `pepr build` });
    }, time.toMs("3m"));

    it("should build successfully", () => {
      expect(buildOutput.exitcode).toBe(0);
      expect(buildOutput.stdout.join("").trim()).toContain("K8s resource for the module saved");
    });

    it("should generate K8s YAML manifest", () => {
      expect(existsSync(`${testModule}/dist/pepr-module-esm-embed-test.yaml`)).toBe(true);
    });

    it("should generate zarf manifest", () => {
      expect(existsSync(`${testModule}/dist/zarf.yaml`)).toBe(true);
    });

    it("should generate Helm chart directory", () => {
      expect(existsSync(`${testModule}/dist/esm-embed-test-chart`)).toBe(true);
    });
  });
});
