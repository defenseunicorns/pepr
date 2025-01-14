// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, describe, expect, it } from "@jest/globals";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { Workdir } from "../helpers/workdir";
import * as time from "../helpers/time";
import * as pepr from "../helpers/pepr";

const FILE = path.basename(__filename);
const HERE = __dirname;

describe("init", () => {
  const workdir = new Workdir(`${FILE}`, `${HERE}/../testroot/cli`);

  beforeAll(async () => {
    await workdir.recreate();
  });

  it(
    "gives command line help",
    async () => {
      const argz = "--help";
      const result = await pepr.cli(workdir.path(), { cmd: `pepr init ${argz}` });
      expect(result.exitcode).toBe(0);
      expect(result.stderr.join("").trim()).toBe("");
      expect(result.stdout.at(0)).toMatch("Usage: pepr init");
    },
    time.toMs("2m"),
  );

  it(
    "creates new module using input args",
    async () => {
      const name = "flags-name";
      const desc = "flags-desc";
      const errb = "reject";
      const argz = [
        `--name ${name}`,
        `--description ${desc}`,
        `--errorBehavior ${errb}`,
        "--confirm",
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
      expect(packageJson.pepr.onError).toBe(errb);
    },
    time.toMs("2m"),
  );
});
