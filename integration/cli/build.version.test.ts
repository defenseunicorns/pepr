// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, describe, expect, it } from "@jest/globals";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { Workdir } from "../helpers/workdir";
import * as time from "../helpers/time";
import * as pepr from "../helpers/pepr";
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

    describe("using a specified pepr version", () => {
      const cliVersion = "0.0.0-development";
      const version = "1.2.3";

      it(
        "builds",
        async () => {
          const argz = [`--version ${version}`].join(" ");
          const build = await pepr.cli(mod, { cmd: `pepr build ${argz}` });
          expect(build.exitcode).toBe(0);
          expect(build.stderr.join("").trim()).toBe("");
          expect(build.stdout.join("").trim()).toContain(cliVersion);

          // TODO: team talk
          // looks like it's just giving back the `pepr --version` then exiting,
          //  rather than buidling/affecting the output files at all..?
          expect(await file.exists(`${mod}/dist`)).toBe(false);
          // TODO: end
        },
        time.toMs("1m"),
      );

      // it(
      //   "outputs appropriate configuration",
      //   async () => { /* TOOD? */ }
      // );
    });
  });
});
