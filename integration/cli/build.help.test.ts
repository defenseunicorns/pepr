// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, describe, expect, it } from "@jest/globals";
import * as path from "node:path";
import { Workdir } from "../helpers/workdir";
import * as pepr from "../helpers/pepr";
import * as time from "../helpers/time";

const FILE = path.basename(__filename);
const HERE = __dirname;

describe("build", () => {
  const workdir = new Workdir(`${FILE}`, `${HERE}/../testroot/cli`);

  beforeAll(async () => {
    await workdir.recreate();
  });

  it(
    "gives command line help",
    async () => {
      const argz = "--help";
      const result = await pepr.cli(workdir.path(), { cmd: `pepr build ${argz}` });
      expect(result.exitcode).toBe(0);
      expect(result.stderr.join("").trim()).toBe("");
      expect(result.stdout.at(0)).toMatch("Usage: pepr build");
    },
    time.toMs("30s"),
  );
});
