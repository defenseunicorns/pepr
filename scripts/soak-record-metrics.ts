// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2024-Present The Pepr Authors

// Parses Prometheus metrics from soak test log files and appends a row to the metrics CSV.
// Usage: soak-record-metrics.ts <iteration> <auditor-log> <informer-log> <metrics-csv>

import fs from "node:fs";

const iteration = process.argv[2];
const auditorLog = process.argv[3];
const informerLog = process.argv[4];
const metricsCSV = process.argv[5];

if (!iteration) {
  console.error("iteration number required");
  process.exit(1);
}
if (!auditorLog) {
  console.error("auditor log path required");
  process.exit(1);
}
if (!informerLog) {
  console.error("informer log path required");
  process.exit(1);
}
if (!metricsCSV) {
  console.error("metrics csv path required");
  process.exit(1);
}

// watch_controller_failures_total: simple counter, take the value directly
const auditorLines = fs
  .readFileSync(auditorLog, "utf-8")
  .split("\n")
  .filter(line => !line.startsWith("#"))
  .filter(line => line.includes("watch_controller_failures_total"));

const lastAuditorLine = auditorLines.at(-1);
const ctrlFailures = lastAuditorLine?.split(/\s+/)?.at(-1) || 0;

const informerLines = fs
  .readFileSync(informerLog, "utf-8")
  .split("\n")
  .filter(line => !line.startsWith("#"));

// pepr_cache_miss: gauge per time window e.g. pepr_cache_miss{window="..."} 16 — sum all windows

const cacheMissLines = informerLines.filter(line => line.includes("pepr_cache_miss"));
const cacheMisses = cacheMissLines.reduce((sum, line) => {
  const value = Number(line.split(/\s+/).at(-1));
  return sum + (isNaN(value) ? 0 : value);
}, 0);
// pepr_resync_failure_count: label holds failure count e.g. {count="0"} 1 — sum non-zero count labels

const resyncFailureLines = informerLines.filter(line => line.includes("pepr_resync_failure_count"));
const resyncFailures = resyncFailureLines.reduce((sum, line) => {
  const match = line.match(/count="(\d+)"/);
  const value = match ? Number(match[1]) : 0;
  return sum + value;
}, 0);

// Compute deltas using a state file that tracks the previous cumulative values.

const prevStatePath = metricsCSV.replace(/\.csv$/, ".prev");

let prevCtrl = 0;
let prevCache = 0;

if (fs.existsSync(prevStatePath)) {
  const parts = fs.readFileSync(prevStatePath, "utf-8").trim().split(",");
  prevCtrl = Number(parts[0]) || 0;
  prevCache = Number(parts[1]) || 0;
}

const ctrlFailuresDelta = Number(ctrlFailures) - prevCtrl;
const cacheMissesDelta = cacheMisses - prevCache;

fs.writeFileSync(prevStatePath, `${ctrlFailures},${cacheMisses}\n`);

const timestamp = new Date().toISOString();
const row = `${iteration},${timestamp},${ctrlFailuresDelta},${cacheMissesDelta},${resyncFailures}\n`;
fs.appendFileSync(metricsCSV, row);
