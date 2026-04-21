// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2024-Present The Pepr Authors

// Reads soak test metrics and writes a Markdown summary to $GITHUB_STEP_SUMMARY.
// Usage: soak-summary.ts <metrics-csv> <informer-log> <failure-reason>

import fs from "node:fs";

const metricsCSV = process.argv[2];
const informerLog = process.argv[3];
const failureReason = process.argv[4];

if (!metricsCSV) {
  console.error("metrics csv path required");
  process.exit(1);
}
if (!informerLog) {
  console.error("informer log path required");
  process.exit(1);
}
if (!failureReason) {
  console.error("failure reason path required");
  process.exit(1);
}

const summary = process.env.GITHUB_STEP_SUMMARY!;

const csvContent = fs.existsSync(metricsCSV) ? fs.readFileSync(metricsCSV, "utf-8") : "";
const csvLines = csvContent.split("\n").filter(line => line.trim() !== "");

if (csvLines.length < 2) {
  fs.appendFileSync(summary, "## Soak Test Results\n");
  fs.appendFileSync(summary, "No metrics collected.\n");
  process.exit(0);
}

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

const ctrlFailuresStatus = totalCtrlFailures === 0 ? "✅" : "❌";
const resyncFailuresStatus = finalResyncFailures === 0 ? "✅" : "❌";
const cacheMissesStatus = midrunMisses === 0 ? "✅" : "⚠️";

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

const lines = [
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

fs.appendFileSync(summary, lines.join("\n") + "\n");

if (fs.existsSync(failureReason)) {
  fs.appendFileSync(summary, "### ❌ Failure Reason\n");
  fs.appendFileSync(summary, fs.readFileSync(failureReason, "utf-8"));
} else {
  fs.appendFileSync(summary, "### ✅ Test Passed\n");
}
