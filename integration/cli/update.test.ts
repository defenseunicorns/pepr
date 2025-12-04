// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, describe, expect, it } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { Workdir } from "../helpers/workdir";
import * as time from "../helpers/time";
import * as pepr from "../helpers/pepr";

const FILE = path.basename(__filename);
const HERE = __dirname;
const name = "update";
describe("update", () => {
  const workdir = new Workdir(`${FILE}`, `${HERE}/../testroot/cli`);

  beforeAll(async () => {
    await workdir.recreate();
  }, time.toMs("4m"));

  it(
    "gives command line help",
    async () => {
      const argz = "--help";
      const result = await pepr.cli(workdir.path(), { cmd: `pepr update ${argz}` });
      expect(result.exitcode).toBe(0);
      expect(result.stderr.join("").trim()).toBe("");
      expect(result.stdout.at(0)).toMatch("Usage: pepr update [options]");
    },
    time.toMs("2m"),
  );

  it(
    "creates new module using input args so that we can update",
    async () => {
      const desc = "flags-desc";
      const errorBehavior = "reject";
      const argz = [
        `--name ${name}`,
        `--description ${desc}`,
        `--error-behavior ${errorBehavior}`,
        `--uuid random-identifier`,
        "--yes",
        "--skip-post-init",
      ].join(" ");
      const result = await pepr.cli(workdir.path(), { cmd: `pepr init ${argz}` });
      expect(result.exitcode).toBe(0);
      expect(result.stderr.join("").trim()).toBe("");
      expect(result.stdout.join("").trim()).toContain("New Pepr module created");

      const packageJson = JSON.parse(
        await fs.readFile(`${workdir.path()}/${name}/package.json`, { encoding: "utf8" }),
      );
      expect(packageJson.name).toBe(name);
      expect(packageJson.description).toBe(desc);
      expect(packageJson.pepr.onError).toBe(errorBehavior);
      await pepr.cli(`${workdir.path()}/${name}`, { cmd: `npm install` });
    },
    time.toMs("2m"),
  );

  it(
    "updates the Pepr module",
    async () => {
      const argz = ["--skip-template-update"];
      const result = await pepr.cli(`${workdir.path()}/${name}`, { cmd: `pepr update ${argz}` });
      expect(result.exitcode).toBe(0);
      expect(result.stderr.join("").trim()).toBe("");
      expect(result.stdout.join("").trim()).toContain("Updating the Pepr module...");
      expect(result.stdout.join("").trim()).toContain("Module updated successfully");
      expect(result.stdout.join("").trim()).not.toContain("Error updating Pepr module");
      console.log(result.stdout.join("").trim());
      const packageJson = JSON.parse(
        await fs.readFile(`${workdir.path()}/${name}/package.json`, { encoding: "utf8" }),
      );
      const latestVersion = await pepr.cli(workdir.path(), {
        cmd: "npx --yes pepr@latest --version",
      });
      expect(packageJson.dependencies.pepr).toContain(latestVersion.stdout.join("").trim());
    },
    time.toMs("2m"),
  );
});
