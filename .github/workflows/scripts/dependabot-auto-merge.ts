// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

type PullRequestEvent = {
  pull_request: {
    html_url: string;
    head: { sha: string };
    commits: number;
    draft: boolean;
  };
};

type CurrentPullRequest = {
  headRefOid: string;
  isDraft: boolean;
  autoMergeRequest: unknown;
};

const event = JSON.parse(
  readFileSync(process.env.GITHUB_EVENT_PATH!, "utf8"),
) as PullRequestEvent;
const eventPr = event.pull_request;
const currentPr = JSON.parse(
  execFileSync(
    "gh",
    [
      "pr",
      "view",
      eventPr.html_url,
      "--json",
      "headRefOid,isDraft,autoMergeRequest",
    ],
    { encoding: "utf8" },
  ),
) as CurrentPullRequest;

// 1. If new commits arrived, let their newer workflow run handle the PR.
if (currentPr.headRefOid !== eventPr.head.sha) {
  process.exit(0);
}

// 2. Every package must be a development patch, such as 1.2.3 -> 1.2.4.
// Missing or invalid metadata never qualifies for auto-merge.
let dependencies: unknown = [];
try {
  dependencies = JSON.parse(process.env.DEPENDENCIES_JSON || "[]");
} catch {
  console.log("Invalid metadata; auto-merge will stay off.");
}

function isDevelopmentPatch(dependency: unknown): boolean {
  if (dependency === null || typeof dependency !== "object") {
    return false;
  }
  const update = dependency as Record<string, unknown>;
  return (
    update.packageEcosystem === "npm_and_yarn" &&
    update.dependencyGroup === "development-dependencies" &&
    update.dependencyType === "direct:development" &&
    update.updateType === "version-update:semver-patch" &&
    update.directory === "/" &&
    update.targetBranch === "main" &&
    update.maintainerChanges === false
  );
}

const allUpdatesAreDevelopmentPatches =
  Array.isArray(dependencies) &&
  dependencies.length > 0 &&
  dependencies.every(isDevelopmentPatch);
const canAutoMerge =
  process.env.METADATA_OUTCOME === "success" &&
  eventPr.commits === 1 &&
  !eventPr.draft &&
  !currentPr.isDraft &&
  allUpdatesAreDevelopmentPatches;

// 3. Turn auto-merge on or off. Required CI and code-owner approval still apply.
// This does not execute PR code or change when security PRs are created.
if (canAutoMerge) {
  execFileSync(
    "gh",
    [
      "pr",
      "merge",
      "--auto",
      "--squash",
      "--match-head-commit",
      eventPr.head.sha,
      eventPr.html_url,
    ],
    { stdio: "inherit" },
  );
} else if (currentPr.autoMergeRequest) {
  execFileSync("gh", ["pr", "merge", "--disable-auto", eventPr.html_url], {
    stdio: "inherit",
  });
}
