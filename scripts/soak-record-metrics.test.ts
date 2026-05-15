// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2024-Present The Pepr Authors

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  parseCtrlFailures,
  parseCacheMisses,
  parseResyncFailures,
  recordMetrics,
} from "./soak-record-metrics.js";

describe("parseCtrlFailures", () => {
  it("extracts the value from a standard Prometheus counter line", () => {
    const content = `# HELP watch_controller_failures_total Total failures
# TYPE watch_controller_failures_total counter
watch_controller_failures_total 42`;
    expect(parseCtrlFailures(content)).toBe(42);
  });

  it("returns the last matching line when multiple lines match", () => {
    const content = `watch_controller_failures_total 10
watch_controller_failures_total 20`;
    expect(parseCtrlFailures(content)).toBe(20);
  });

  it("returns 0 when no matching lines exist", () => {
    expect(parseCtrlFailures("")).toBe(0);
    expect(parseCtrlFailures("some_other_metric 5")).toBe(0);
  });

  it("returns 0 for unparseable values", () => {
    expect(parseCtrlFailures("watch_controller_failures_total NaN")).toBe(0);
  });
});

describe("parseCacheMisses", () => {
  it("sums all pepr_cache_miss gauge windows", () => {
    const content = `pepr_cache_miss{window="5m"} 10
pepr_cache_miss{window="15m"} 6`;
    expect(parseCacheMisses(content)).toBe(16);
  });

  it("skips comment lines", () => {
    const content = `# HELP pepr_cache_miss Cache misses
# TYPE pepr_cache_miss gauge
pepr_cache_miss{window="5m"} 7`;
    expect(parseCacheMisses(content)).toBe(7);
  });

  it("does not match pepr_cache_miss_other metrics", () => {
    const content = `pepr_cache_miss{window="5m"} 10
pepr_cache_miss_other{window="5m"} 99`;
    expect(parseCacheMisses(content)).toBe(10);
  });

  it("returns 0 when no matching lines exist", () => {
    expect(parseCacheMisses("")).toBe(0);
  });
});

describe("parseResyncFailures", () => {
  it("sums non-zero count labels", () => {
    const content = `pepr_resync_failure_count{count="0"} 1
pepr_resync_failure_count{count="3"} 1
pepr_resync_failure_count{count="2"} 1`;
    expect(parseResyncFailures(content)).toBe(5);
  });

  it("returns 0 when all counts are zero", () => {
    const content = `pepr_resync_failure_count{count="0"} 1`;
    expect(parseResyncFailures(content)).toBe(0);
  });

  it("returns 0 when no matching lines exist", () => {
    expect(parseResyncFailures("")).toBe(0);
  });
});

describe("recordMetrics", () => {
  let tmpDir: string;
  let auditorPath: string;
  let informerPath: string;
  let csvPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "soak-test-"));
    auditorPath = path.join(tmpDir, "auditor-log.txt");
    informerPath = path.join(tmpDir, "informer-log.txt");
    csvPath = path.join(tmpDir, "metrics.csv");

    fs.writeFileSync(
      csvPath,
      "iteration,timestamp,watch_controller_failures_delta,pepr_cache_miss_delta,pepr_resync_failure_count\n",
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("appends a row to the CSV with correct deltas on first iteration", () => {
    fs.writeFileSync(auditorPath, "watch_controller_failures_total 5");
    fs.writeFileSync(informerPath, 'pepr_cache_miss{window="5m"} 10');

    recordMetrics({
      iteration: 1,
      auditorLogPath: auditorPath,
      informerLogPath: informerPath,
      metricsCsvPath: csvPath,
    });

    const lines = fs.readFileSync(csvPath, "utf-8").trim().split("\n");
    expect(lines).toHaveLength(2); // header + 1 data row
    const cols = lines[1].split(",");
    expect(cols[0]).toBe("1");
    expect(cols[2]).toBe("5"); // ctrl delta = 5 - 0
    expect(cols[3]).toBe("10"); // cache delta = 10 - 0
  });

  it("computes deltas correctly across iterations", () => {
    fs.writeFileSync(auditorPath, "watch_controller_failures_total 5");
    fs.writeFileSync(informerPath, 'pepr_cache_miss{window="5m"} 10');
    recordMetrics({
      iteration: 1,
      auditorLogPath: auditorPath,
      informerLogPath: informerPath,
      metricsCsvPath: csvPath,
    });

    fs.writeFileSync(auditorPath, "watch_controller_failures_total 8");
    fs.writeFileSync(informerPath, 'pepr_cache_miss{window="5m"} 14');
    recordMetrics({
      iteration: 2,
      auditorLogPath: auditorPath,
      informerLogPath: informerPath,
      metricsCsvPath: csvPath,
    });

    const lines = fs.readFileSync(csvPath, "utf-8").trim().split("\n");
    expect(lines).toHaveLength(3);
    const cols = lines[2].split(",");
    expect(cols[2]).toBe("3"); // 8 - 5
    expect(cols[3]).toBe("4"); // 14 - 10
  });

  it("handles counter resets by treating the new value as the delta", () => {
    // Simulate initial state
    fs.writeFileSync(auditorPath, "watch_controller_failures_total 100");
    fs.writeFileSync(informerPath, 'pepr_cache_miss{window="5m"} 50');
    recordMetrics({
      iteration: 1,
      auditorLogPath: auditorPath,
      informerLogPath: informerPath,
      metricsCsvPath: csvPath,
    });

    // Counter reset: values drop below previous
    fs.writeFileSync(auditorPath, "watch_controller_failures_total 3");
    fs.writeFileSync(informerPath, 'pepr_cache_miss{window="5m"} 2');
    recordMetrics({
      iteration: 2,
      auditorLogPath: auditorPath,
      informerLogPath: informerPath,
      metricsCsvPath: csvPath,
    });

    const lines = fs.readFileSync(csvPath, "utf-8").trim().split("\n");
    const cols = lines[2].split(",");
    expect(cols[2]).toBe("3"); // reset: use new value, not negative
    expect(cols[3]).toBe("2");
  });
});
