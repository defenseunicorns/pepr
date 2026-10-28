// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const cli = resolve("node_modules/npm-package-json-lint/dist/cli.js");
const config = resolve("config/.npmpackagejsonlintrc.json");
const manifest = readFileSync(resolve("package.json"), "utf8");

describe("package manifest lint", () => {
  it.each([
    ["valid manifest", manifest, 0],
    [
      "duplicate top-level properties",
      manifest.replace('"name": "pepr",', '"name": "pepr",\n  "name": "pepr",'),
      2,
    ],
    [
      "duplicate nested properties",
      manifest.replace('"scripts": {', '"scripts": {\n    "build": "duplicate",'),
      2,
    ],
  ])("checks %s through the CLI", (_label, content, status) => {
    const directory = mkdtempSync(join(tmpdir(), "pepr-package-lint-"));
    try {
      writeFileSync(join(directory, "package.json"), content);
      const result = spawnSync(process.execPath, [cli, "--configFile", config, "./package.json"], {
        cwd: directory,
        encoding: "utf8",
      });
      expect(result.error).toBeUndefined();
      expect(result.status, result.stdout + result.stderr).toBe(status);
      if (status !== 0) {
        expect(result.stdout).toContain("no-duplicate-properties");
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
