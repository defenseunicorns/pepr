// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

// Audits .grype.yaml for stale CVE suppressions, removes them, writes a workflow summary, and conditionally
// opens a PR.
//
// A suppression is stale if grype no longer matches it against the scanned image.
// After removing stale entries the script re-runs grype to verify the count of
// non-suppressed matches is unchanged — if it differs, .grype.yaml is restored
// and the script exits with an error.

import { execSync } from "child_process";
import { readFileSync, writeFileSync, appendFileSync } from "fs";
import { load } from "js-yaml";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GrypeConfig {
  ignore?: { vulnerability: string; [key: string]: unknown }[];
  [key: string]: unknown;
}

interface GrypeMatch {
  vulnerability: { id: string };
  relatedVulnerabilities?: { id: string }[];
}

interface GrpeScanResult {
  matches?: GrypeMatch[];
  ignoredMatches?: GrypeMatch[];
}

interface AuditResult {
  staleIds: string[];
  matchCount: number;
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const IMAGE = process.env.IMAGE ?? "pepr:dev";
const GRYPE_YAML = process.env.GRYPE_YAML ?? ".grype.yaml";
const GRYPE_CMD = process.env.GRYPE_CMD ?? "grype";
const GITHUB_OUTPUT = process.env.GITHUB_OUTPUT ?? "";
const GITHUB_STEP_SUMMARY = process.env.GITHUB_STEP_SUMMARY ?? "";
const RUN_URL = process.env.RUN_URL ?? "";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function run(cmd: string): string {
  return execSync(cmd, { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 }).trim();
}

function quote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

function scanImage(): GrpeScanResult {
  const json = run(
    `${quote(GRYPE_CMD)} ${quote(IMAGE)} --config ${quote(GRYPE_YAML)} --output json`,
  );
  return JSON.parse(json) as GrpeScanResult;
}

function collectIgnoredIds(scan: GrpeScanResult): Set<string> {
  const ids = new Set<string>();
  for (const m of scan.ignoredMatches ?? []) {
    ids.add(m.vulnerability.id);
    for (const r of m.relatedVulnerabilities ?? []) {
      ids.add(r.id);
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Core audit
// ---------------------------------------------------------------------------

function guardSingleKeyEntries(entries: GrypeConfig["ignore"]): void {
  for (const entry of entries ?? []) {
    const keys = Object.keys(entry);
    if (keys.length > 1 || (keys.length === 1 && keys[0] !== "vulnerability")) {
      console.error(
        `ERROR: ${GRYPE_YAML} contains suppression entries with sub-keys (e.g. ${keys.join(", ")}).`,
      );
      console.error(
        "Automatic removal is not supported. Please audit stale suppressions manually.",
      );
      process.exit(1);
    }
  }
}

function removeStaleEntries(staleIds: string[]): void {
  const staleSet = new Set(staleIds);
  const rawLines = readFileSync(GRYPE_YAML, "utf-8").split("\n");
  const filtered = rawLines.filter(line => {
    const match = line.match(/^\s*- vulnerability:\s+(\S+)\s*$/);
    return !(match && staleSet.has(match[1]));
  });
  writeFileSync(GRYPE_YAML, filtered.join("\n"));
}

function verifyRemoval(matchCountBefore: number): number {
  console.log("==> Verifying updated suppression list...");
  const scanAfter = scanImage();
  const matchCountAfter = (scanAfter.matches ?? []).length;
  console.log(`Non-suppressed matches (after):  ${matchCountAfter}`);

  if (matchCountBefore !== matchCountAfter) {
    run(`git checkout -- ${quote(GRYPE_YAML)}`);
    throw new Error(
      `Non-suppressed match count changed from ${matchCountBefore} to ${matchCountAfter}. ` +
        `One or more suppressions were incorrectly identified as stale. ` +
        `.grype.yaml has been restored to its original state via git.`,
    );
  }

  console.log(`==> Verification passed — match count unchanged at ${matchCountAfter}.`);
  return matchCountAfter;
}

function auditSuppressions(): AuditResult {
  console.log(`==> Scanning ${IMAGE} with current suppression list...`);
  const scan = scanImage();

  const matchCountBefore = (scan.matches ?? []).length;
  console.log(`Non-suppressed matches (before): ${matchCountBefore}`);

  const config = load(readFileSync(GRYPE_YAML, "utf-8")) as GrypeConfig;
  const ignoreEntries = config.ignore ?? [];
  guardSingleKeyEntries(ignoreEntries);

  const ignoredIds = collectIgnoredIds(scan);
  const staleIds = ignoreEntries.map(e => e.vulnerability).filter(id => !ignoredIds.has(id));

  if (staleIds.length === 0) {
    console.log("No stale suppressions found — nothing to do.");
    return { staleIds: [], matchCount: matchCountBefore };
  }

  console.log("==> Stale suppressions identified:");
  for (const id of staleIds) {
    console.log(`   ${id}`);
  }

  removeStaleEntries(staleIds);
  const matchCount = verifyRemoval(matchCountBefore);
  return { staleIds, matchCount };
}

// ---------------------------------------------------------------------------
// PR creation / update
// ---------------------------------------------------------------------------

function createOrUpdatePR(staleIds: string[], matchCount: number): void {
  const staleCount = staleIds.length;
  const entryWord = staleCount === 1 ? "y" : "ies";
  const bullets = staleIds.map(id => `- ${id}`).join("\n");

  const title = `chore: remove ${staleCount} stale CVE suppression(s) from .grype.yaml`;
  const body = [
    "## Summary",
    "",
    `The weekly grype suppression audit found **${staleCount}** entr${entryWord} in \`.grype.yaml\` ` +
      "that no longer match any vulnerability in the `pepr:dev` image and can be safely removed.",
    "",
    "## Removed suppressions",
    "",
    bullets,
    "",
    "## Verification",
    "",
    "After removing these entries the script re-ran grype against `pepr:dev` with the updated " +
      "`.grype.yaml`. The count of non-suppressed vulnerabilities was identical before and after " +
      `removal (**${matchCount}**), confirming that none of the removed entries were actively ` +
      "covering a live vulnerability in the image.",
    "",
    "If this check had failed, the script would have aborted and this PR would not have been opened or updated.",
    "",
    `_Generated by the [Grype Suppression Audit](${RUN_URL}) workflow._`,
  ].join("\n");

  const branch = "grype/suppression-audit";

  run('git config user.name "github-actions[bot]"');
  run('git config user.email "github-actions[bot]@users.noreply.github.com"');
  run(`git checkout -b ${branch}`);
  run("git add .grype.yaml");
  run(`git commit -m "chore: remove ${staleCount} stale CVE suppression(s) from .grype.yaml"`);
  run(`git push origin ${branch} --force`);

  const existing = run(
    `gh pr list --head ${branch} --state open --json number -q '.[0].number // empty'`,
  );

  if (existing) {
    console.log(`Updating existing PR #${existing}...`);
    writeFileSync("/tmp/pr-body.md", body);
    run(`gh pr edit ${existing} --title "${title}" --body-file /tmp/pr-body.md`);
  } else {
    console.log("Opening new PR...");
    writeFileSync("/tmp/pr-body.md", body);
    run(`gh pr create --title "${title}" --body-file /tmp/pr-body.md --head ${branch} --base main`);
  }
}

// ---------------------------------------------------------------------------
// Workflow summary
// ---------------------------------------------------------------------------

function writeSummary(
  auditOutcome: "success" | "failure",
  prOutcome: "success" | "failure" | "skipped",
  staleIds: string[],
): void {
  if (!GITHUB_STEP_SUMMARY) return;

  const staleCount = staleIds.length;
  const lines: string[] = ["# Grype Suppression Audit", ""];

  if (auditOutcome !== "success") {
    lines.push(
      `> **Warning**: The audit step did not complete successfully (outcome: ${auditOutcome}).`,
      "> Results below may be incomplete. Check the workflow logs for details.",
      "",
    );
  }

  lines.push(
    "| | |",
    "|---|---|",
    "| **Image scanned** | `pepr:dev` |",
    `| **Stale suppressions found** | ${staleCount} |`,
    "",
  );

  if (staleCount === 0 && auditOutcome === "success") {
    lines.push(
      "## All suppressions are still active",
      "",
      "No changes to `.grype.yaml` are needed.",
    );
  } else if (staleCount > 0) {
    lines.push("### Stale suppressions");
    for (const id of staleIds) {
      lines.push(`- ${id}`);
    }
    lines.push("");

    if (prOutcome === "success") {
      lines.push(
        "## PR created or updated",
        "",
        "The above suppressions were removed from `.grype.yaml`. A PR has been opened or updated for review.",
      );
    } else if (prOutcome === "skipped") {
      lines.push(
        "## PR step was skipped",
        "",
        "The stale suppressions above were detected but the PR step did not run.",
      );
    } else {
      lines.push(
        "## PR creation failed",
        "",
        `> **Warning**: The PR step failed (outcome: ${prOutcome}). Check the workflow logs for details.`,
      );
    }
    lines.push("");
  }

  appendFileSync(GITHUB_STEP_SUMMARY, lines.join("\n"));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  let auditOutcome: "success" | "failure" = "success";
  let prOutcome: "success" | "failure" | "skipped" = "skipped";
  let result: AuditResult = { staleIds: [], matchCount: 0 };

  try {
    result = auditSuppressions();

    // Write outputs for downstream workflow steps
    if (GITHUB_OUTPUT) {
      const outputLines = [
        `stale_count=${result.staleIds.length}`,
        `stale_list<<EOF`,
        result.staleIds.join("\n"),
        "EOF",
        `match_count=${result.matchCount}`,
      ];
      appendFileSync(GITHUB_OUTPUT, outputLines.join("\n") + "\n");
    }
  } catch (err) {
    auditOutcome = "failure";
    console.error(err instanceof Error ? err.message : err);
  }

  if (auditOutcome === "success" && result.staleIds.length > 0) {
    try {
      createOrUpdatePR(result.staleIds, result.matchCount);
      prOutcome = "success";
    } catch (err) {
      prOutcome = "failure";
      console.error("PR step failed:", err instanceof Error ? err.message : err);
    }
  }

  writeSummary(auditOutcome, prOutcome, result.staleIds);

  if (auditOutcome === "failure" || prOutcome === "failure") {
    process.exit(1);
  }
}

main();
