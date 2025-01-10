// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, describe, expect, it } from "@jest/globals";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Workdir } from "./workdir";
import * as time from "./time";
import * as sut from "./pepr";

const FILE = path.basename(__filename);
const HERE = __dirname;

describe("pepr", () => {
  describe("projectRoot", () => {
    it("returns pepr project root directory", async () => {
      const expected = path.resolve(HERE, "../..");
      const actual = await sut.projectRoot();
      expect(actual).toBe(expected);
    });
  });

  describe("prepWorkdir", () => {
    const workdir = new Workdir(`${FILE}-prepWorkdir`, `${HERE}/../testroot/helpers`);

    beforeAll(async () => await workdir.recreate());

    it("builds pepr package and drops .tgz into given directory", async () => {
      await sut.prepWorkdir(workdir.path());
      const files = await fs.readdir(workdir.path());

      expect(files).toHaveLength(1);
      expect(files).toContain("pepr-0.0.0-development.tgz");
    });
  });

  describe("cli", () => {
    const workdir = new Workdir(`${FILE}-cli`, `${HERE}/../testroot/helpers`);

    beforeAll(async () => {
      await workdir.recreate();
      await sut.prepWorkdir(workdir.path());
    });

    it(
      "invokes pepr command via .tgz",
      async () => {
        const res = await sut.cli(workdir.path(), { cmd: "pepr --version" });
        expect(res.exitcode).toBe(0);
        expect(res.stderr.join("").trim()).toBe("");
        expect(res.stdout.join("").trim()).toBe("0.0.0-development");
      },
      time.toMs("2m"),
    );
  });
});
