// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { Workdir } from "../helpers/workdir";
import * as time from "../helpers/time";
import * as pepr from "../helpers/pepr";
import { Result } from "../helpers/cmd";
import { setupTlsEnv, cleanupTlsEnv } from "../helpers/tls";

const FILE = path.basename(__filename);
const HERE = __dirname;

interface BuildContext {
  testModule: string;
  buildOutput: Result;
}

interface FormatTestCase {
  name: string;
  id: string;
  initUuid: string;
  esm?: boolean;
  buildFlags?: string;
  needsTls?: boolean;
  assertions: (ctx: BuildContext) => void;
}

const FORMAT_CASES: FormatTestCase[] = [
  {
    name: "default embedded CJS build",
    id: "cjs",
    initUuid: "random-identifier",
    assertions: (ctx): void => {
      it("builds successfully with default options", () => {
        expect(ctx.buildOutput.exitcode).toBe(0);
        expect(ctx.buildOutput.stderr.join("").trim()).toBe("");
        expect(ctx.buildOutput.stdout.join("").trim()).toContain(
          "K8s resource for the module saved",
        );
      });
    },
  },
  {
    name: "embedded ESM build (type: module)",
    id: "esm-embed",
    initUuid: "esm-embed-test",
    esm: true,
    assertions: (ctx): void => {
      it("should build successfully", () => {
        expect(ctx.buildOutput.exitcode).toBe(0);
        expect(ctx.buildOutput.stdout.join("").trim()).toContain(
          "K8s resource for the module saved",
        );
      });

      it("should generate K8s YAML manifest", () => {
        expect(existsSync(`${ctx.testModule}/dist/pepr-module-esm-embed-test.yaml`)).toBe(true);
      });

      it("should generate zarf manifest", () => {
        expect(existsSync(`${ctx.testModule}/dist/zarf.yaml`)).toBe(true);
      });

      it("should generate Helm chart directory", () => {
        expect(existsSync(`${ctx.testModule}/dist/esm-embed-test-chart`)).toBe(true);
      });
    },
  },
  {
    name: "non-embedded ESM build (type: module, --no-embed)",
    id: "esm-auto",
    initUuid: "esm-test-auto",
    esm: true,
    needsTls: true,
    buildFlags: "--no-embed",
    assertions: (ctx): void => {
      it("should build successfully with auto-detected ESM", () => {
        expect(ctx.buildOutput.exitcode).toBe(0);
        expect(ctx.buildOutput.stdout.join("").trim()).toContain("Module built successfully at");
      });

      it.each([["pepr.d.ts.map"], ["pepr.d.ts"], ["pepr.mjs.map"], ["pepr.mjs"]])(
        "should create: '%s'",
        filename => {
          expect(existsSync(`${ctx.testModule}/dist/${filename}`)).toBe(true);
        },
      );

      it("should not create CJS output files", () => {
        expect(existsSync(`${ctx.testModule}/dist/pepr.js`)).toBe(false);
      });

      it("should use ESM syntax in the output file", async () => {
        const content = await fs.readFile(`${ctx.testModule}/dist/pepr.mjs`, "utf-8");
        expect(content).not.toContain("require(");
        expect(content).not.toContain("module.exports");
      });

      it("should produce a module that can be loaded by Node.js", async () => {
        const modulePath = `${ctx.testModule}/dist/pepr.mjs`;
        const absolutePath = path.resolve(modulePath);
        await expect(import(absolutePath)).resolves.toBeDefined();
      });
    },
  },
  {
    name: "non-embedded CJS build (--no-embed)",
    id: "noembed",
    initUuid: "random-identifier",
    needsTls: true,
    buildFlags: "--no-embed",
    assertions: (ctx): void => {
      it("should build successfully", () => {
        expect(ctx.buildOutput.exitcode).toBe(0);
        expect(ctx.buildOutput.stderr.join("").trim()).toContain("");
        expect(ctx.buildOutput.stdout.join("").trim()).toContain("Module built successfully at");
      });

      it.each([["pepr.d.ts.map"], ["pepr.d.ts"], ["pepr.js.map"], ["pepr.js"]])(
        "should create: '%s'",
        filename => {
          expect(existsSync(`${ctx.testModule}/dist/${filename}`)).toBe(true);
        },
      );

      it.each([
        { filename: `^UUID-chart/$` },
        { filename: `^pepr-UUID\\.js\\.map$` },
        { filename: `^pepr-UUID\\.js$` },
        { filename: `^pepr-module-UUID\\.yaml$` },
        { filename: `^zarf\\.yaml$` },
        // Legal files are omitted when empty, see esbuild/#3670
        { filename: `^pepr-UUID\\.js\\.LEGAL\\.txt$` },
        { filename: `^pepr\\.js\\.LEGAL\\.txt$` },
      ])("should not create: '$filename'", ({ filename }) => {
        const uuidPattern = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
        const regex = new RegExp(filename.replace("UUID", uuidPattern));
        const files = readdirSync(`${ctx.testModule}/dist/`);
        const matchingFiles = files.filter(file => regex.test(file));
        expect(matchingFiles.length).toBe(0);
      });

      it("should produce a module that can be loaded by Node.js", async () => {
        const modulePath = `${ctx.testModule}/dist/pepr.js`;
        const absolutePath = path.resolve(modulePath);
        await expect(import(absolutePath)).resolves.toBeDefined();
      });
    },
  },
];

describe("build formats", () => {
  const workdir = new Workdir(FILE, `${HERE}/../testroot/cli`);
  const anyNeedsTls = FORMAT_CASES.some(c => c.needsTls);

  beforeAll(async () => {
    await workdir.recreate();
    if (anyNeedsTls) {
      await setupTlsEnv(workdir.path());
    }
  }, time.toMs("60s"));

  afterAll(() => {
    if (anyNeedsTls) {
      cleanupTlsEnv();
    }
  });

  describe.each(FORMAT_CASES)("$name", testCase => {
    const testModule = `${workdir.path()}/${testCase.id}`;
    const ctx: BuildContext = {
      testModule,
      buildOutput: { stdout: [], stderr: [], exitcode: -1 },
    };

    beforeAll(async () => {
      await fs.rm(testModule, { recursive: true, force: true });

      const initArgs = [
        `--name ${testCase.id}`,
        `--description ${testCase.id}`,
        `--error-behavior reject`,
        `--uuid ${testCase.initUuid}`,
        "--yes",
        "--skip-post-init",
      ].join(" ");
      await pepr.cli(workdir.path(), { cmd: `pepr init ${initArgs}` });
      await pepr.tgzifyModule(testModule);

      if (testCase.esm) {
        const pkgPath = `${testModule}/package.json`;
        const pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
        pkg.type = "module";
        await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2));
      }

      await pepr.cli(testModule, { cmd: `npm install` });

      const buildCmd = testCase.buildFlags ? `pepr build ${testCase.buildFlags}` : `pepr build`;
      ctx.buildOutput = await pepr.cli(testModule, { cmd: buildCmd });
    }, time.toMs("3m"));

    testCase.assertions(ctx);
  });
});
