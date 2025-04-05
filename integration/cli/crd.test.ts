// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, describe, expect, it } from "@jest/globals";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { Workdir } from "../helpers/workdir";
import * as time from "../helpers/time";
import * as pepr from "../helpers/pepr";
import { before } from "node:test";

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
    const tsTypesFilePath = path.join(workdir.path(), "api", version, `${kind.toLocaleLowerCase()}_types.ts`);
    const crdFilePath = path.join(workdir.path(), "crds",`${kind.toLocaleLowerCase()}.yaml`);
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
      await pepr.cli(workdir.path(), { cmd: `pepr crd generate` });
    }, time.toMs("2m"));

    describe("npx pepr api create - creates TypeScript types", () => {
      it("creates a new CRD TypeScript definition at api/<group>/<kind>_types.ts", async () => {
        try {
          await fs.access(tsTypesFilePath);
          expect(true).toBe(true);
        } catch (err) {
          expect(err).toBeFalsy();
        }
      });
    });

    describe("npx pepr api generate - generates a CRD from TypeScript types", () => {
      it("creates a new CRD at crds/<kind>.yaml", async () => {
        try {
          await fs.access(crdFilePath);
          expect(true).toBe(true);
        } catch (err) {
          expect(err).toBeFalsy();
        }
      });
    });
  });
});
