// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { Workdir } from "../helpers/workdir";
import * as time from "../helpers/time";
import * as pepr from "../helpers/pepr";

const FILE = path.basename(__filename);
const HERE = __dirname;

describe("build", () => {
  const workdir = new Workdir(`${FILE}`, `${HERE}/../testroot/cli`);

  beforeAll(async () => {
    await workdir.recreate();
    await pepr.prepWorkdir(workdir.path());
  });

  it(
    "gives command line help",
    async () => {
      const argz = "--help";
      const res = await pepr.cli(workdir.path(), { cmd: `pepr build ${argz}` });
      expect(res.exitcode).toBe(0);
      expect(res.stderr.join("").trim()).toBe("");
      expect(res.stdout.at(0)).toMatch("Usage: pepr build");
    },
    time.toMs("2m"),
  );

  describe("builds a module successfully", () => {
    const NAME = "module";
    const moduleDir = `${workdir.path()}/${NAME}`;

    beforeEach(async () => {
      await fs.rm(moduleDir, { recursive: true, force: true });
      const argz = [
        `--name ${NAME}`,
        `--description description`,
        `--errorBehavior reject`,
        "--confirm",
        "--skip-post-init",
      ].join(" ");
      await pepr.cli(workdir.path(), { cmd: `pepr init ${argz}` });
      await pepr.tgzifyModule(moduleDir);
      await pepr.cli(moduleDir, { cmd: `npm install` });
    }, time.toMs("2m"));

    it(
      "using default options",
      async () => {
        const build = await pepr.cli(moduleDir, { cmd: `pepr build` });
        expect(build.exitcode).toBe(0);
        expect(build.stderr.join("").trim()).toBe("");
        expect(build.stdout.join("").trim()).toContain("K8s resource for the module saved");
      },
      time.toMs("2m"),
    );

    // it(
    //   "using build-time override options",
    //   async () => {
    //     const build = await pepr.cli(moduleDir, { cmd: `pepr build` });
    //     expect(build.exitcode).toBe(0);
    //     expect(build.stderr.join("").trim()).toBe("");
    //     expect(build.stdout.join("").trim()).toContain("K8s resource for the module saved");
    //   },
    //   time.toMs("2m"),
    // );
  });
});
