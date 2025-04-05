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


describe("crd", () => {
  const workdir = new Workdir(`${FILE}`, `${HERE}/../testroot/cli`);
  
  beforeAll(async () => {
    await workdir.recreate();
  }, time.toMs("60s"));

  describe("creates TypeScript types", () => {
    const id = FILE.split(".").at(1);
    const testModule = `${workdir.path()}/${id}`;

    const group = "cache";
    const version = "v1alpha1";
    const kind = "Memcached";
    const domain = "pepr.dev";
    const scope = "Namespaced";
    const plural = "memcacheds";
    const shortName = "mc";
    const filePath = path.join(workdir.path(), "api", group, `${kind}_types.ts`);

    beforeAll(async () => {
      await fs.rm(testModule, { recursive: true, force: true });
      const argz = [
        `--group ${group}`,
        `--version ${version}`,
        `--kind ${kind}`,
        `--shortName ${shortName}`,
        `--plural ${plural}`,
        `--scope ${scope}`,
        `--domain ${domain}`,
      ].join(" ");
      await pepr.cli(workdir.path(), { cmd: `pepr crd create ${argz}` });
      // await pepr.tgzifyModule(testModule);
      // await pepr.cli(testModule, { cmd: `npm install` });
    }, time.toMs("2m"));

    describe("creates TypeScript types", () => {
      it("creates a new CRD TypeScript definition at api/<group>/<kind>_types.ts", async () => {
        // Check if the file exists
        try {
          await fs.access(filePath);
          // File exists, so the test passes
          expect(true).toBe(true);
        } catch (err) {
          // File does not exist, fail the test
          expect(err).toBeFalsy();
        }
      });
    });
  });
});
