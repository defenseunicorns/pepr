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
  esm: boolean;
  embedded: boolean;
}

const FORMAT_CASES: FormatTestCase[] = [
  {
    name: "default embedded CJS build",
    id: "cjs",
    initUuid: "random-identifier",
    esm: false,
    embedded: true,
  },
  {
    name: "embedded ESM build (type: module)",
    id: "esm-embed",
    initUuid: "esm-embed-test",
    esm: true,
    embedded: true,
  },
  {
    name: "non-embedded ESM build (type: module, --no-embed)",
    id: "esm-auto",
    initUuid: "esm-test-auto",
    esm: true,
    embedded: false,
  },
  {
    name: "non-embedded CJS build (--no-embed)",
    id: "noembed",
    initUuid: "random-identifier",
    esm: false,
    embedded: false,
  },
];

describe("build formats", () => {
  const workdir = new Workdir(FILE, `${HERE}/../testroot/cli`);
  const anyNeedsTls = FORMAT_CASES.some(c => !c.embedded);

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

      const buildCmd = testCase.embedded ? `pepr build` : `pepr build --no-embed`;
      ctx.buildOutput = await pepr.cli(testModule, { cmd: buildCmd });
    }, time.toMs("3m"));

    // --- Build process assertions (all cases) ---

    it("should exit with code 0", () => {
      expect(ctx.buildOutput.exitcode).toBe(0);
    });

    it("should produce no stderr output", () => {
      expect(ctx.buildOutput.stderr.join("").trim()).toBe("");
    });

    it("should print the expected success message", () => {
      const expected = testCase.embedded
        ? "K8s resource for the module saved"
        : "Module built successfully at";
      expect(ctx.buildOutput.stdout.join("").trim()).toContain(expected);
    });

    // --- Non-embedded output file assertions ---

    if (!testCase.embedded) {
      const ext = testCase.esm ? "mjs" : "js";

      it.each([[`pepr.d.ts.map`], [`pepr.d.ts`], [`pepr.${ext}.map`], [`pepr.${ext}`]])(
        "should create: '%s'",
        filename => {
          expect(existsSync(`${testModule}/dist/${filename}`)).toBe(true);
        },
      );

      const wrongExt = testCase.esm ? "js" : "mjs";
      it(`should not create pepr.${wrongExt} (wrong format)`, () => {
        expect(existsSync(`${testModule}/dist/pepr.${wrongExt}`)).toBe(false);
      });
    }

    // --- Embedded artifact assertions ---

    if (testCase.embedded) {
      it("should generate K8s YAML manifest", () => {
        expect(
          existsSync(`${testModule}/dist/pepr-module-${testCase.initUuid}.yaml`),
        ).toBe(true);
      });

      it("should generate zarf manifest", () => {
        expect(existsSync(`${testModule}/dist/zarf.yaml`)).toBe(true);
      });

      it("should generate Helm chart directory", () => {
        expect(existsSync(`${testModule}/dist/${testCase.initUuid}-chart`)).toBe(true);
      });
    }

    // --- No embedded artifacts in non-embedded builds ---

    if (!testCase.embedded) {
      it.each([
        { filename: `^UUID-chart$` },
        { filename: `^pepr-UUID\\.(js|cjs)$` },
        { filename: `^pepr-UUID\\.(js|cjs)\\.map$` },
        { filename: `^pepr-module-UUID\\.yaml$` },
        { filename: `^zarf\\.yaml$` },
        // Legal files are omitted when empty, see esbuild/#3670
        { filename: `^pepr-UUID\\.(js|cjs)\\.LEGAL\\.txt$` },
        { filename: `^pepr\\.(js|mjs)\\.LEGAL\\.txt$` },
      ])("should not create: '$filename'", ({ filename }) => {
        const uuidPattern = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
        const regex = new RegExp(filename.replace("UUID", uuidPattern));
        const files = readdirSync(`${testModule}/dist/`);
        const matchingFiles = files.filter(file => regex.test(file));
        expect(matchingFiles.length).toBe(0);
      });
    }

    // --- ESM syntax validation ---

    if (!testCase.embedded && testCase.esm) {
      it("should use ESM syntax (no require/module.exports)", async () => {
        const content = await fs.readFile(`${testModule}/dist/pepr.mjs`, "utf-8");
        expect(content).not.toContain("require(");
        expect(content).not.toContain("module.exports");
      });
    }

    // --- Module loadable by Node.js ---

    if (!testCase.embedded) {
      it("should produce a module that can be loaded by Node.js", async () => {
        const ext = testCase.esm ? "mjs" : "js";
        const modulePath = `${testModule}/dist/pepr.${ext}`;
        const absolutePath = path.resolve(modulePath);
        await expect(import(absolutePath)).resolves.toBeDefined();
      });
    }
  });
});
