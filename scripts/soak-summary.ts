// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2024-Present The Pepr Authors

// Reads soak test metrics and writes a Markdown summary to $GITHUB_STEP_SUMMARY.
// Usage: soak-summary.ts <metrics-csv> <informer-log> <failure-reason>

import fs from "node:fs";
import { Command } from "commander";

const program = new Command()
  .description("Reads soak test metrics and writes a Markdown summary to $GITHUB_STEP_SUMMARY.")
  .argument("<metrics-csv>", "path to metrics CSV file")
  .argument("<informer-log>", "path to informer log file")
  .argument("<failure-reason>", "path to failure reason file")
  .parse();

const [metricsCSV, informerLog, failureReason] = program.args;

function buildSummaryLines(csvLines: string[]): string[] {
  const finalRow = csvLines.at(-1)!.split(",");
  const iters = finalRow[0];
  const finalResyncFailures = Number(finalRow[4]) || 0;

  const totalCtrlFailures = csvLines.slice(1).reduce((sum, line) => {
    const cols = line.split(",");
    return sum + (Number(cols[2]) || 0);
  }, 0);

  const startupMisses = Number(csvLines[1]?.split(",")[3]) || 0;
  const midrunMisses = csvLines.slice(2).reduce((sum, line) => {
    const value = Number(line.split(",")[3]) || 0;
    return sum + (value > 0 ? value : 0);
  }, 0);
  const totalCacheMisses = startupMisses + midrunMisses;

  const ctrlFailuresStatus = totalCtrlFailures === 0 ? "PASS" : "FAIL";
  const resyncFailuresStatus = finalResyncFailures === 0 ? "PASS" : "FAIL";
  const cacheMissesStatus = midrunMisses === 0 ? "PASS" : "WARN";

  const resyncTotal = fs
    .readFileSync(informerLog, "utf-8")
    .split("\n")
    .filter(line => !line.startsWith("#"))
    .filter(line => line.includes("pepr_resync_failure_count"))
    .reduce((sum, line) => {
      const value = Number(line.split(/\s+/).at(-1));
      return sum + (isNaN(value) ? 0 : value);
    }, 0);

  const cacheMissesDisplay =
    totalCacheMisses === 0
      ? "0"
      : `${totalCacheMisses} total (${startupMisses} startup, ${midrunMisses} mid-run)`;

  const resyncFailuresDisplay = `${finalResyncFailures} failures across ${resyncTotal} resyncs`;

  return [
    "## Soak Test Results",
    "",
    "| Metric | Value | Status |",
    "|--------|-------|--------|",
    `| \`watch_controller_failures_total\` | ${totalCtrlFailures} | ${ctrlFailuresStatus} |`,
    `| \`pepr_cache_miss\` | ${cacheMissesDisplay} | ${cacheMissesStatus} |`,
    `| \`pepr_resync_failure_count\` | ${resyncFailuresDisplay} | ${resyncFailuresStatus} |`,
    "",
    `**Iterations completed:** ${iters} / 70 | **Duration:** ~${Number(iters) * 5} minutes`,
    "",
  ];
}

function main(): void {
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (!summary) {
    console.error("GITHUB_STEP_SUMMARY environment variable is not set");
    process.exitCode = 1;
    return;
  }

  const csvContent = fs.existsSync(metricsCSV) ? fs.readFileSync(metricsCSV, "utf-8") : "";
  const csvLines = csvContent.split("\n").filter(line => line.trim() !== "");

  if (csvLines.length < 2) {
    fs.appendFileSync(summary, "## Soak Test Results\n");
    fs.appendFileSync(summary, "No metrics collected.\n");
    return;
  }

  fs.appendFileSync(summary, buildSummaryLines(csvLines).join("\n") + "\n");

  if (fs.existsSync(failureReason)) {
    fs.appendFileSync(summary, "### Failure Reason\n");
    fs.appendFileSync(summary, fs.readFileSync(failureReason, "utf-8"));
  } else {
    fs.appendFileSync(summary, "### Test Passed\n");
  }
}

main();
