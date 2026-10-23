// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { load } from "js-yaml";
import { afterEach, describe, expect, it } from "vitest";

type Step = { name?: string; run?: string; if?: string; with?: Record<string, string> };
type Job = {
  name: string;
  needs?: string[];
  "continue-on-error"?: string;
  strategy?: { "fail-fast": boolean; matrix: { include: string } };
  steps: Step[];
};
const workflow = load(readFileSync(resolve(".github/workflows/uds.yml"), "utf8")) as {
  jobs: Record<string, Job>;
};
const job = workflow.jobs["uds-run"];
const script = (name: string): string => {
  const step = job.steps.find(step => step.name === name);
  if (!step?.run) throw new Error(`Missing workflow script: ${name}`);
  return step.run;
};
const temporaryDirectories: string[] = [];
afterEach(() => temporaryDirectories.splice(0).forEach(path => rmSync(path, { recursive: true })));

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value));
}

function fixture(kfc: string | null = "3.12.6") {
  const root = mkdtempSync(join(tmpdir(), "uds smoke "));
  temporaryDirectories.push(root);
  const consumer = join(root, "uds core");
  const archive = join(root, "candidate pepr.tgz");
  const environment = join(root, "github env");
  const bin = join(root, "bin");
  for (const directory of [consumer, bin, join(root, "package")]) {
    mkdirSync(directory, { recursive: true });
  }
  writeJson(join(root, "package/package.json"), {
    dependencies: kfc === null ? {} : { "kubernetes-fluent-client": kfc },
  });
  writeJson(join(consumer, "package.json"), {
    dependencies: { "kubernetes-fluent-client": "3.12.5" },
  });
  const tar = spawnSync("tar", ["-czf", archive, "-C", root, "package/package.json"]);
  expect(tar.status).toBe(0);
  writeFileSync(environment, "");
  writeFileSync(
    join(bin, "npm"),
    `#!/usr/bin/env node
require('node:fs').writeFileSync(process.env.NPM_ARGS, JSON.stringify(process.argv.slice(2)));
process.exit(Number(process.env.NPM_EXIT || 0));
`,
    { mode: 0o755 },
  );
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    UDS_CORE: consumer,
    PEPR_TGZ: archive,
    GITHUB_ENV: environment,
    PEPR_KFC_VERSION: "3.12.6",
    NPM_ARGS: join(root, "npm args.json"),
  };
  return { root, consumer, archive, environment, env };
}

function run(script: string, test: ReturnType<typeof fixture>, extraEnv = {}) {
  return spawnSync("bash", ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", script], {
    cwd: test.root,
    env: { ...test.env, ...extraEnv },
    encoding: "utf8",
  });
}

function installPackage(directory: string, name: string, version: string): void {
  mkdirSync(directory, { recursive: true });
  writeJson(join(directory, "package.json"), { name, version, main: "index.js" });
  writeFileSync(join(directory, "index.js"), "module.exports = {};\n");
}

describe("UDS smoke workflow contract", () => {
  it("keeps the pinned required lane and adds informational HEAD only for schedule/manual", () => {
    const matrix = job.strategy!.matrix.include;
    const lanes = (event: string): { name: string; ref: string; experimental: boolean }[] =>
      runInNewContext(matrix.slice(3, -2), {
        github: { event_name: event },
        fromJSON: JSON.parse,
      });
    const [pinned] = lanes("pull_request");
    expect(pinned).toEqual({ name: "uds run", ref: expect.any(String), experimental: false });
    expect(pinned.ref).toHaveLength(40);
    expect([...pinned.ref].every(char => "0123456789abcdef".includes(char))).toBe(true);
    const head = { name: "uds HEAD compatibility", ref: "main", experimental: true };
    for (const event of ["pull_request", "merge_group"]) expect(lanes(event)).toEqual([pinned]);
    for (const event of ["schedule", "workflow_dispatch"])
      expect(lanes(event)).toEqual([pinned, head]);
    expect(job.name).toBe("${{ matrix.name }}");
    expect(job.strategy!["fail-fast"]).toBe(false);
    expect(job["continue-on-error"]).toBe("${{ matrix.experimental }}");
    expect(job.needs).toEqual(["pepr-build"]);
    expect(workflow.jobs["pepr-build"]["continue-on-error"]).toBeUndefined();
    expect(
      job.steps.find(step => step.with?.repository === "defenseunicorns/uds-core")?.with?.ref,
    ).toBe("${{ matrix.ref }}");
    expect(
      job.steps.some(step => step.if === "always()" && step.run?.includes("GITHUB_STEP_SUMMARY")),
    ).toBe(true);
    expect(script("uds run")).toContain('PEPR_CUSTOM_IMAGE="pepr:dev" uds run slim-dev');
  });

  it("installs the artifact pin and candidate together with paths containing spaces", () => {
    const test = fixture();
    const result = run(script("install candidate Pepr and KFC"), test);
    expect(result.status, result.stderr).toBe(0);
    const args: string[] = JSON.parse(readFileSync(test.env.NPM_ARGS, "utf8"));
    expect(args).toContain("install");
    expect(args).toContain("--save-exact");
    expect(args).toContain(test.archive);
    expect(args).toContain("kubernetes-fluent-client@3.12.6");
    expect(args).not.toContain("kubernetes-fluent-client@3.12.5");
    expect(args.some(arg => ["--force", "--legacy-peer-deps", "--no-save"].includes(arg))).toBe(
      false,
    );
    expect(readFileSync(test.environment, "utf8")).toContain("PEPR_KFC_VERSION=3.12.6");
  });

  it.each([null, "", "^3.12.6"])(
    "rejects artifact KFC dependency %s before npm installation",
    pin => {
      const test = fixture(pin);
      const result = run(script("install candidate Pepr and KFC"), test);
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain("kubernetes-fluent-client");
      expect(() => readFileSync(test.env.NPM_ARGS)).toThrow();
    },
  );

  it("propagates installation errors before the smoke command can run", () => {
    const test = fixture();
    const result = run(`${script("install candidate Pepr and KFC")}\necho smoke-started`, test, {
      NPM_EXIT: "42",
    });
    expect(result.status).toBe(42);
    expect(result.stdout).not.toContain("smoke-started");
    expect(
      job.steps.indexOf(job.steps.find(step => step.name === "install candidate Pepr and KFC")!),
    ).toBeLessThan(job.steps.indexOf(job.steps.find(step => step.name === "uds run")!));
  });

  it.each([
    { name: "shared expected package", nested: undefined, root: "3.12.7", success: true },
    {
      name: "different physical package at the same version",
      nested: "3.12.6",
      root: "3.12.6",
      success: false,
    },
    { name: "old conflicting root pin", nested: "3.12.6", root: "3.12.5", success: false },
    { name: "shared wrong version", nested: undefined, root: "3.12.5", success: false },
  ])("checks KFC resolution for $name", ({ nested, root, success }) => {
    const test = fixture();
    const modules = join(test.consumer, "node_modules");
    installPackage(join(modules, "pepr"), "pepr", "0.0.0-development");
    installPackage(join(modules, "kubernetes-fluent-client"), "kubernetes-fluent-client", root);
    if (nested) {
      installPackage(
        join(modules, "pepr/node_modules/kubernetes-fluent-client"),
        "kubernetes-fluent-client",
        nested,
      );
    }
    const result = run(`${script("verify KFC resolution")}\necho smoke-started`, test, {
      PEPR_KFC_VERSION: success ? root : "3.12.6",
    });
    expect(result.status === 0, result.stderr).toBe(success);
    expect(result.stdout.includes("smoke-started")).toBe(success);
  });
});
