// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, describe, expect, it } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs/promises";
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

  describe("when building a module", () => {
    const id = FILE.split(".").at(1);
    const testModule = `${workdir.path()}/${id}`;
    let formatOutput: Result;

    beforeAll(async () => {
      await fs.rm(testModule, { recursive: true, force: true });
      const initArgs = [
        `--name ${id}`,
        `--description ${id}`,
        `--error-behavior reject`,
        `--uuid format`,
        "--yes",
        "--skip-post-init",
      ].join(" ");
      await pepr.cli(workdir.path(), { cmd: `pepr init ${initArgs}` });
      await pepr.tgzifyModule(testModule);
      await pepr.cli(testModule, { cmd: `npm install` });

      formatOutput = await pepr.cli(testModule, { cmd: `pepr format` });
    }, time.toMs("3m"));

    it("should execute 'pepr format'", () => {
      expect(formatOutput.exitcode).toBe(0);
      expect(formatOutput.stderr.join("").trim()).toContain("");
      expect(formatOutput.stdout.join("").trim()).toContain("Module formatted");
    });

    describe("when validating results", () => {
      beforeAll(async () => {
        // Add a line break to the line `export const HelloPepr = new Capability({` in `hello-pepr.ts` located in testModule
        const capabilityFilePath = path.join(testModule, "capabilities", "hello-pepr.ts");
        const content = await fs.readFile(capabilityFilePath, "utf8");

        // Find the line with Capability declaration and add a line break after 'new'
        const modifiedContent = content.replace(
          /export const HelloPepr = new Capability\({/g,
          "export const HelloPepr = new\nCapability({",
        );

        // Write the modified content back to file
        await fs.writeFile(capabilityFilePath, modifiedContent);
      });
      it(
        "should support --validate-only",
        async () => {
          formatOutput = await pepr.cli(testModule, { cmd: `pepr format --validate-only` });
          expect(formatOutput.exitcode).toBe(1);
          expect(formatOutput.stderr.join("").trim()).toMatch(/File .* is not formatted correctly/);
          expect(formatOutput.stdout.join("").trim()).toContain("");
        },
        time.toMs("15s"),
      );

      it(
        "should support -v",
        async () => {
          formatOutput = await pepr.cli(testModule, { cmd: `pepr format -v` });
          expect(formatOutput.exitcode).toBe(1);
          expect(formatOutput.stderr.join("").trim()).toMatch(/File .* is not formatted correctly/);
          expect(formatOutput.stdout.join("").trim()).toContain("");
        },
        time.toMs("15s"),
      );
    });
  });
});
