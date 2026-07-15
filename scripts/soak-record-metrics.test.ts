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
  it.each([
    {
      desc: "extracts value from a standard Prometheus counter line",
      input: `# HELP watch_controller_failures_total Total failures
# TYPE watch_controller_failures_total counter
watch_controller_failures_total 42`,
      expected: 42,
    },
    { desc: "returns 0 when no matching lines exist", input: "some_other_metric 5", expected: 0 },
    { desc: "returns 0 for empty input", input: "", expected: 0 },
  ])("$desc", ({ input, expected }) => {
    expect(parseCtrlFailures(input)).toBe(expected);
  });
});

describe("parseCacheMisses", () => {
  it.each([
    {
      desc: "sums all pepr_cache_miss gauge windows",
      input: `pepr_cache_miss{window="5m"} 10\npepr_cache_miss{window="15m"} 6`,
      expected: 16,
    },
    {
      desc: "skips comment lines",
      input: `# HELP pepr_cache_miss Cache misses\npepr_cache_miss{window="5m"} 7`,
      expected: 7,
    },
    {
      desc: "does not match pepr_cache_miss_other metrics",
      input: `pepr_cache_miss{window="5m"} 10\npepr_cache_miss_other{window="5m"} 99`,
      expected: 10,
    },
    { desc: "returns 0 when no matching lines exist", input: "", expected: 0 },
  ])("$desc", ({ input, expected }) => {
    expect(parseCacheMisses(input)).toBe(expected);
  });
});

describe("parseResyncFailures", () => {
  it.each([
    {
      desc: "sums non-zero count labels",
      input: `pepr_resync_failure_count{count="0"} 1\npepr_resync_failure_count{count="3"} 1\npepr_resync_failure_count{count="2"} 1`,
      expected: 5,
    },
    {
      desc: "returns 0 when all counts are zero",
      input: `pepr_resync_failure_count{count="0"} 1`,
      expected: 0,
    },
    { desc: "returns 0 when no matching lines exist", input: "", expected: 0 },
  ])("$desc", ({ input, expected }) => {
    expect(parseResyncFailures(input)).toBe(expected);
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

  it("records baseline with zero deltas on first iteration", () => {
    fs.writeFileSync(auditorPath, "watch_controller_failures_total 5");
    fs.writeFileSync(informerPath, 'pepr_cache_miss{window="5m"} 10');

    recordMetrics({
      iteration: 1,
      auditorLogPath: auditorPath,
      informerLogPath: informerPath,
      metricsCsvPath: csvPath,
    });

    const lines = fs.readFileSync(csvPath, "utf-8").trim().split("\n");
    expect(lines).toHaveLength(2);
    const cols = lines[1].split(",");
    expect(cols[0]).toBe("1");
    expect(cols[2]).toBe("0");
    expect(cols[3]).toBe("0");
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
    const cols = lines[2].split(",");
    expect(cols[2]).toBe("3"); // 8 - 5
    expect(cols[3]).toBe("4"); // 14 - 10
  });

  it("handles counter resets by treating the new value as the delta", () => {
    fs.writeFileSync(auditorPath, "watch_controller_failures_total 100");
    fs.writeFileSync(informerPath, 'pepr_cache_miss{window="5m"} 50');
    recordMetrics({
      iteration: 1,
      auditorLogPath: auditorPath,
      informerLogPath: informerPath,
      metricsCsvPath: csvPath,
    });

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
    expect(cols[2]).toBe("3");
    expect(cols[3]).toBe("2");
  });
});
