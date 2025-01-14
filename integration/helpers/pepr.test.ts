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

  describe("tgzifyModule", () => {
    const workdir = new Workdir(`${FILE}-tgzifyModule`, `${HERE}/../testroot/helpers`);

    beforeAll(async () => await workdir.recreate());

    it("converts module source to install pepr from .tgz", async () => {
      const modulePath = `${workdir.path()}/module`;
      const packagePath = `${modulePath}/package.json`;
      let packageJson = {
        dependencies: {
          pepr: "0.0.0-development",
        },
      };
      await fs.mkdir(modulePath, { recursive: true });
      await fs.writeFile(packagePath, JSON.stringify(packageJson, null, 2));

      await sut.tgzifyModule(modulePath);

      packageJson = JSON.parse(await fs.readFile(packagePath, { encoding: "utf8" }));
      const root = await sut.projectRoot();
      expect(packageJson.dependencies.pepr).toBe(`file://${root}/pepr-0.0.0-development.tgz`);
    });
  });

  describe("cli", () => {
    const workdir = new Workdir(`${FILE}-cli`, `${HERE}/../testroot/helpers`);

    beforeAll(async () => {
      await workdir.recreate();
    });

    it(
      "can invoke pepr command via .tgz",
      async () => {
        const result = await sut.cli(workdir.path(), { cmd: "pepr --version" });
        expect(result.exitcode).toBe(0);
        expect(result.stderr.join("").trim()).toBe("");
        expect(result.stdout.join("").trim()).toBe("0.0.0-development");
      },
      time.toMs("2m"),
    );
  });
});
