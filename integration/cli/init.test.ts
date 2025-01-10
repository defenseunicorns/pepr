// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, describe, expect, it } from "@jest/globals";
import * as path from "node:path";
import { Workdir } from "../helpers/workdir";
import * as time from "../helpers/time";
import * as pepr from "../helpers/pepr";

const FILE = path.basename(__filename);
const HERE = __dirname;

describe("init", () => {
  const workdir = new Workdir(`${FILE}`, `${HERE}/../workroot/cli`);

  beforeAll(async () => {
    await workdir.recreate();
    await pepr.prepWorkdir(workdir.path());
  });

  it(
    "init --help",
    async () => {
      const res = await pepr.cli(workdir.path(), { cmd: "pepr init --help" });
      expect(res.exitcode).toBe(0);
      expect(res.stderr.join("").trim()).toBe("");
      expect(res.stdout.at(0)).toMatch("Usage: pepr init");
    },
    time.toMs("2m"),
  );
});
