// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, describe, expect, it } from "@jest/globals";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import * as f from "node:fs";
import { execSync } from "node:child_process";
import { Workdir } from "../helpers/workdir";
import * as time from "../helpers/time";
import * as pepr from "../helpers/pepr";
import * as resource from "../helpers/resource";
import YAML from "yaml";

const FILE = path.basename(__filename);
const HERE = __dirname;

describe("build env vars", () => {
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
        `--uuid ${id}`,
        "--confirm",
        "--skip-post-init",
      ].join(" ");
      await pepr.cli(workdir.path(), { cmd: `pepr init ${argz}` });
      await pepr.tgzifyModule(testModule);
      await pepr.cli(testModule, { cmd: `npm install` });
      const data = f.readFileSync(`${testModule}/package.json`, "utf8");
      const json = JSON.parse(data);
      json.pepr = {
        ...json.pepr,
        env: {
          ...json.pepr.env,
          CUSTOM_ENV_VAR1: "one",
          CUSTOM_ENV_VAR2: "two",
        },
      };
      f.writeFileSync(`${testModule}/package.json`, JSON.stringify(json, null, 2));
    }, time.toMs("2m"));

    describe("using custom env vars", () => {
      const outputDir = `${testModule}/dist`;

      let packageJson;
      let uuid: string;

      beforeAll(async () => {
        const build = await pepr.cli(testModule, { cmd: `pepr build` });

        expect(build.exitcode).toBe(0);
        expect(build.stderr.join("").trim()).toBe("");
        expect(build.stdout.join("").trim()).toContain("K8s resource for the module saved");

        packageJson = await resource.fromFile(`${testModule}/package.json`);
        uuid = packageJson.pepr.uuid;
      }, time.toMs("1m"));

      it("adds the env vars to values.yaml", () => {
        const valuesYaml = f.readFileSync(`${outputDir}/${uuid}-chart/values.yaml`, "utf-8");
        const values = YAML.parse(valuesYaml);
        expect(values.admission.env).toEqual([
          { name: "PEPR_PRETTY_LOG", value: "false" },
          { name: "LOG_LEVEL", value: "info" },
          { name: "CUSTOM_ENV_VAR1", value: "one" },
          { name: "CUSTOM_ENV_VAR2", value: "two" },
        ]);
        expect(values.watcher.env).toEqual([
          { name: "PEPR_PRETTY_LOG", value: "false" },
          { name: "LOG_LEVEL", value: "info" },
          { name: "CUSTOM_ENV_VAR1", value: "one" },
          { name: "CUSTOM_ENV_VAR2", value: "two" },
        ]);
        const deploymentManifests = execSync("helm template . ", {
          cwd: `${outputDir}/${uuid}-chart`,
        }).toString();
        expect(deploymentManifests).toContain("CUSTOM_ENV_VAR1");
        expect(deploymentManifests).toContain("CUSTOM_ENV_VAR2");
        expect(deploymentManifests).toContain("one");
        expect(deploymentManifests).toContain("two");
      });

      it("adds env vars to the deployments", () => {
        const manifestsFile = f.readFileSync(`${outputDir}/pepr-module-envvars.yaml`, "utf-8");
        expect(manifestsFile).toContain("CUSTOM_ENV_VAR1");
        expect(manifestsFile).toContain("CUSTOM_ENV_VAR2");
        expect(manifestsFile).toContain("one");
        expect(manifestsFile).toContain("two");
      });
    });
  });
});
