// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const script = resolve(".github/workflows/scripts/dependabot-auto-merge.ts");
const prUrl = "https://github.com/defenseunicorns/pepr/pull/1";
const developmentPatch = {
  dependencyName: "prettier",
  packageEcosystem: "npm_and_yarn",
  dependencyGroup: "development-dependencies",
  dependencyType: "direct:development",
  updateType: "version-update:semver-patch",
  directory: "/",
  targetBranch: "main",
  maintainerChanges: false,
};

type Fixture = {
  dependencies?: unknown;
  rawMetadata?: string;
  metadataOutcome?: string;
  commits?: number;
  draft?: boolean;
  current?: {
    headRefOid?: string;
    isDraft?: boolean;
    autoMergeRequest?: object | null;
  };
};

describe("Dependabot auto-merge CLI", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "pepr-automerge-test-"));
    mkdirSync(join(directory, "bin"));
    // Replace only gh. Each test executes the actual TypeScript CLI with Node.
    writeFileSync(
      join(directory, "bin", "gh"),
      [
        "#!/usr/bin/env node",
        'const fs = require("node:fs");',
        "const args = process.argv.slice(2);",
        'if (args[0] === "pr" && args[1] === "view") {',
        "  console.log(process.env.CURRENT_PR);",
        "} else {",
        '  fs.appendFileSync(process.env.GH_CALLS, JSON.stringify(args) + "\\n");',
        "}",
        "",
      ].join("\n"),
      { mode: 0o755 },
    );
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  function run(fixture: Fixture = {}): string[][] {
    const eventFile = join(directory, "event.json");
    const callsFile = join(directory, "calls.jsonl");
    writeFileSync(
      eventFile,
      JSON.stringify({
        pull_request: {
          html_url: prUrl,
          head: { sha: "current" },
          commits: fixture.commits ?? 1,
          draft: fixture.draft ?? false,
        },
      }),
    );
    writeFileSync(callsFile, "");
    execFileSync(process.execPath, ["--experimental-strip-types", script], {
      env: {
        ...process.env,
        PATH: join(directory, "bin") + delimiter + process.env.PATH,
        GITHUB_EVENT_PATH: eventFile,
        GH_CALLS: callsFile,
        CURRENT_PR: JSON.stringify({
          headRefOid: "current",
          isDraft: false,
          autoMergeRequest: {},
          ...fixture.current,
        }),
        METADATA_OUTCOME: fixture.metadataOutcome ?? "success",
        DEPENDENCIES_JSON:
          fixture.rawMetadata ??
          JSON.stringify(
            fixture.dependencies === undefined
              ? [developmentPatch]
              : fixture.dependencies,
          ),
      },
      stdio: "pipe",
    });
    return readFileSync(callsFile, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as string[]);
  }

  it("enables auto-merge for a development patch at the exact event head", () => {
    expect(run()).toEqual([
      [
        "pr",
        "merge",
        "--auto",
        "--squash",
        "--match-head-commit",
        "current",
        prUrl,
      ],
    ]);
  });

  it("allows a group when every package is a development patch", () => {
    expect(
      run({
        dependencies: [
          developmentPatch,
          { ...developmentPatch, dependencyName: "tsx" },
        ],
      }),
    ).toEqual([
      [
        "pr",
        "merge",
        "--auto",
        "--squash",
        "--match-head-commit",
        "current",
        prUrl,
      ],
    ]);
  });

  it.each([
    { name: "production", change: { dependencyType: "direct:production" } },
    { name: "indirect", change: { dependencyType: "indirect" } },
    { name: "minor", change: { updateType: "version-update:semver-minor" } },
    { name: "major", change: { updateType: "version-update:semver-major" } },
    { name: "unknown version", change: { updateType: "" } },
    { name: "security group", change: { dependencyGroup: "npm-security" } },
    { name: "Vitest group", change: { dependencyGroup: "vitest" } },
    { name: "ungrouped", change: { dependencyGroup: "" } },
    { name: "Docker", change: { packageEcosystem: "docker" } },
    { name: "Actions", change: { packageEcosystem: "github_actions" } },
    { name: "subdirectory", change: { directory: "/other" } },
    { name: "other target", change: { targetBranch: "release" } },
    { name: "maintainer change", change: { maintainerChanges: true } },
  ])("revokes auto-merge if a mixed group contains $name", ({ change }) => {
    expect(
      run({
        dependencies: [developmentPatch, { ...developmentPatch, ...change }],
      }),
    ).toEqual([["pr", "merge", "--disable-auto", prUrl]]);
  });

  it.each([
    { name: "empty metadata", fixture: { dependencies: [] } },
    { name: "missing fields", fixture: { dependencies: [{}] } },
    { name: "non-array metadata", fixture: { dependencies: {} } },
    { name: "null metadata", fixture: { dependencies: null } },
    { name: "null entry", fixture: { dependencies: [developmentPatch, null] } },
    { name: "malformed JSON", fixture: { rawMetadata: "{invalid" } },
    { name: "failed verification", fixture: { metadataOutcome: "failure" } },
    { name: "skipped verification", fixture: { metadataOutcome: "skipped" } },
    { name: "added commit", fixture: { commits: 2 } },
    { name: "draft event", fixture: { draft: true } },
    { name: "draft live PR", fixture: { current: { isDraft: true } } },
  ])("revokes a previous opt-in for $name", ({ fixture }) => {
    expect(run(fixture)).toEqual([["pr", "merge", "--disable-auto", prUrl]]);
  });

  it("leaves a newer PR head alone", () => {
    expect(run({ current: { headRefOid: "newer" } })).toEqual([]);
  });

  it("does nothing when an ineligible PR already has auto-merge off", () => {
    expect(
      run({ dependencies: [], current: { autoMergeRequest: null } }),
    ).toEqual([]);
  });
});
