// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2024-Present The Pepr Authors

// Parses Prometheus metrics from soak test log files and appends a row to the metrics CSV.
// Can be imported as a function or run standalone via CLI:
//   npx tsx soak-record-metrics.ts <iteration> <auditor-log> <informer-log> <metrics-csv>

import fs from "node:fs";
import { pathToFileURL } from "node:url";

/** Parse the auditor log and return the cumulative watch_controller_failures_total value. */
export function parseCtrlFailures(auditorContent: string): number {
  const lines = auditorContent
    .split("\n")
    .map(line => line.trim())
    .filter(line => !line.startsWith("#"))
    .filter(line => line.includes("watch_controller_failures_total"));

  const lastLine = lines.at(-1);
  if (!lastLine) return 0;
  const value = Number(lastLine.split(/\s+/).at(-1));
  return isNaN(value) ? 0 : value;
}

/** Parse the informer log and return the sum of all pepr_cache_miss gauge windows. */
export function parseCacheMisses(informerContent: string): number {
  return informerContent
    .split("\n")
    .map(line => line.trim())
    .filter(line => !line.startsWith("#"))
    .filter(line => /^pepr_cache_miss[\s{]/.test(line))
    .reduce((sum, line) => {
      const value = Number(line.split(/\s+/).at(-1));
      return sum + (isNaN(value) ? 0 : value);
    }, 0);
}

/** Parse the informer log and return the sum of non-zero resync failure count labels. */
export function parseResyncFailures(informerContent: string): number {
  return informerContent
    .split("\n")
    .map(line => line.trim())
    .filter(line => !line.startsWith("#"))
    .filter(line => line.includes("pepr_resync_failure_count"))
    .reduce((sum, line) => {
      const match = line.match(/count="(\d+)"/);
      const value = match ? Number(match[1]) : 0;
      return sum + value;
    }, 0);
}

export interface RecordMetricsArgs {
  iteration: number;
  auditorLogPath: string;
  informerLogPath: string;
  metricsCsvPath: string;
}

/**
 * Compute the delta between current and previous values, handling first-iteration
 * baselines and counter resets (e.g. pod restart).
 */
function computeDelta(current: number, prev: number, isBaseline: boolean): number {
  if (isBaseline) return 0;
  return current >= prev ? current - prev : current;
}

/** Read previous cumulative values from the state file, or return zeros if it doesn't exist. */
function readPrevState(prevStatePath: string): {
  prevCtrl: number;
  prevCache: number;
  isFirstIteration: boolean;
} {
  if (!fs.existsSync(prevStatePath)) {
    return { prevCtrl: 0, prevCache: 0, isFirstIteration: true };
  }
  const parts = fs.readFileSync(prevStatePath, "utf-8").trim().split(",");
  return {
    prevCtrl: Number(parts[0]) || 0,
    prevCache: Number(parts[1]) || 0,
    isFirstIteration: false,
  };
}

/**
 * Read metric log files, compute deltas from the previous iteration, and
 * append a row to the metrics CSV. This is the core logic — callable directly
 * from soak-test.ts without spawning a subprocess.
 */
export function recordMetrics({
  iteration,
  auditorLogPath,
  informerLogPath,
  metricsCsvPath,
}: RecordMetricsArgs): void {
  const auditorContent = fs.readFileSync(auditorLogPath, "utf-8");
  const informerContent = fs.readFileSync(informerLogPath, "utf-8");

  const ctrlFailures = parseCtrlFailures(auditorContent);
  const cacheMisses = parseCacheMisses(informerContent);
  const resyncFailures = parseResyncFailures(informerContent);

  if (!metricsCsvPath.endsWith(".csv")) {
    throw new Error(`metricsCsvPath must end in .csv, got: ${metricsCsvPath}`);
  }
  const prevStatePath = `${metricsCsvPath.slice(0, -4)}.prev`;
  const { prevCtrl, prevCache, isFirstIteration } = readPrevState(prevStatePath);

  const ctrlFailuresDelta = computeDelta(ctrlFailures, prevCtrl, isFirstIteration);
  const cacheMissesDelta = computeDelta(cacheMisses, prevCache, isFirstIteration);

  fs.writeFileSync(prevStatePath, `${ctrlFailures},${cacheMisses}\n`);

  const timestamp = new Date().toISOString();
  const row = `${iteration},${timestamp},${ctrlFailuresDelta},${cacheMissesDelta},${resyncFailures}\n`;
  fs.appendFileSync(metricsCsvPath, row);
}

// CLI entry point — only runs when executed directly (not when imported).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , iterationArg, auditorLog, informerLog, metricsCSV] = process.argv;
  if (!iterationArg || !auditorLog || !informerLog || !metricsCSV) {
    console.error(
      "Usage: soak-record-metrics.ts <iteration> <auditor-log> <informer-log> <metrics-csv>",
    );
    process.exit(1);
  }
  recordMetrics({
    iteration: Number(iterationArg),
    auditorLogPath: auditorLog,
    informerLogPath: informerLog,
    metricsCsvPath: metricsCSV,
  });
}
