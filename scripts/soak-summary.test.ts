// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2024-Present The Pepr Authors

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { buildCacheMissTrend, buildSummaryLines, writeSummary } from "./soak-summary.js";
import { STABILIZATION_ITERATIONS, TOTAL_ITERATIONS, INTERVAL_MINUTES } from "./soak-constants.js";

describe("buildCacheMissTrend", () => {
  it("returns empty array when not enough rows for stabilization", () => {
    // Need more than STABILIZATION_ITERATIONS + 1 lines
    const csvLines = Array.from(
      { length: STABILIZATION_ITERATIONS + 1 },
      (_, i) => `${i},2024-01-01T00:00:00Z,0,0,0`,
    );
    expect(buildCacheMissTrend(csvLines, ["70", "2024-01-01", "0", "5", "0"], "70")).toEqual([]);
  });

  it("returns stable trend when growth is within threshold", () => {
    // Build enough lines: header-like line at index 0, then data rows
    const csvLines = Array.from(
      { length: STABILIZATION_ITERATIONS + 2 },
      (_, i) => `${i},2024-01-01T00:00:00Z,0,${i === STABILIZATION_ITERATIONS ? 10 : 0},0`,
    );
    const finalRow = ["70", "2024-01-01T00:00:00Z", "0", "15", "0"];
    const result = buildCacheMissTrend(csvLines, finalRow, "70");

    expect(result).toHaveLength(3);
    expect(result[0]).toContain("Cache Miss Trend");
    expect(result[1]).toContain("Stable");
  });

  it("returns growing trend when growth exceeds threshold", () => {
    const csvLines = Array.from(
      { length: STABILIZATION_ITERATIONS + 2 },
      (_, i) => `${i},2024-01-01T00:00:00Z,0,${i === STABILIZATION_ITERATIONS ? 5 : 0},0`,
    );
    const finalRow = ["70", "2024-01-01T00:00:00Z", "0", "100", "0"];
    const result = buildCacheMissTrend(csvLines, finalRow, "70");

    expect(result[1]).toContain("Growing");
  });
});

describe("buildSummaryLines", () => {
  let tmpDir: string;
  let informerPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "soak-summary-"));
    informerPath = path.join(tmpDir, "informer-log.txt");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("throws on empty CSV lines", () => {
    fs.writeFileSync(informerPath, "");
    expect(() => buildSummaryLines([], informerPath)).toThrow("unexpected empty CSV");
  });

  it("builds summary with zero failures", () => {
    fs.writeFileSync(informerPath, 'pepr_resync_failure_count{count="0"} 1\n');
    const csvLines = [
      "iteration,timestamp,watch_controller_failures_delta,pepr_cache_miss_delta,pepr_resync_failure_count",
      "1,2024-01-01T00:00:00Z,0,0,0",
    ];

    const result = buildSummaryLines(csvLines, informerPath);
    const output = result.join("\n");

    expect(output).toContain("## Soak Test Results");
    expect(output).toContain("| `watch_controller_failures_total` | 0 | ✅ |");
    expect(output).toContain("| `pepr_cache_miss` | 0 | ✅ |");
    expect(output).toContain(`1 / ${TOTAL_ITERATIONS}`);
    expect(output).toContain(`~${1 * INTERVAL_MINUTES} minutes`);
  });

  it("marks controller failures with ❌ status", () => {
    fs.writeFileSync(informerPath, "");
    const csvLines = ["header", "1,2024-01-01T00:00:00Z,3,0,0"];

    const result = buildSummaryLines(csvLines, informerPath);
    const output = result.join("\n");

    expect(output).toContain("| `watch_controller_failures_total` | 3 | ❌ |");
  });

  it("shows cache miss breakdown when misses are non-zero", () => {
    fs.writeFileSync(informerPath, "");
    const csvLines = ["header", "1,2024-01-01T00:00:00Z,0,5,0", "2,2024-01-01T00:05:00Z,0,3,0"];

    const result = buildSummaryLines(csvLines, informerPath);
    const output = result.join("\n");

    // startupMisses = 5 (from row index 1), midrunMisses = 3 (from row index 2+)
    expect(output).toContain("8 total (5 startup, 3 mid-run)");
    expect(output).toContain("⚠️");
  });

  it("marks resync failures with ❌ when non-zero", () => {
    fs.writeFileSync(informerPath, 'pepr_resync_failure_count{count="2"} 1\n');
    const csvLines = ["header", "1,2024-01-01T00:00:00Z,0,0,5"];

    const result = buildSummaryLines(csvLines, informerPath);
    const output = result.join("\n");

    expect(output).toContain("5 failures across");
    expect(output).toContain("❌");
  });

  it("computes resyncTotal from informer log", () => {
    fs.writeFileSync(
      informerPath,
      [
        "# HELP pepr_resync_failure_count Resync failures",
        'pepr_resync_failure_count{count="0"} 1',
        'pepr_resync_failure_count{count="3"} 1',
      ].join("\n"),
    );
    const csvLines = ["header", "1,2024-01-01T00:00:00Z,0,0,0"];

    const result = buildSummaryLines(csvLines, informerPath);
    const output = result.join("\n");

    // resyncTotal = 0 + 3 = 3 (values from count labels, not the gauge values)
    // Wait — the parsing reads the last whitespace-separated value, not the count label
    // Actually looking at the code: it reads line.split(/\s+/).at(-1) which is the gauge value (1)
    // So resyncTotal = 1 + 1 = 2
    expect(output).toContain("0 failures across 2 resyncs");
  });
});

describe("writeSummary", () => {
  let tmpDir: string;
  let csvPath: string;
  let informerPath: string;
  let failurePath: string;
  let summaryPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "soak-summary-"));
    csvPath = path.join(tmpDir, "metrics.csv");
    informerPath = path.join(tmpDir, "informer-log.txt");
    failurePath = path.join(tmpDir, "failure-reason.txt");
    summaryPath = path.join(tmpDir, "summary.md");
    fs.writeFileSync(summaryPath, "");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes 'No metrics collected' when CSV has fewer than 2 lines", () => {
    fs.writeFileSync(csvPath, "header\n");
    fs.writeFileSync(informerPath, "");

    writeSummary({
      metricsCsvPath: csvPath,
      informerLogPath: informerPath,
      failureReasonPath: failurePath,
      summaryPath,
    });

    const output = fs.readFileSync(summaryPath, "utf-8");
    expect(output).toContain("No metrics collected");
  });

  it("writes 'No metrics collected' when CSV does not exist", () => {
    fs.writeFileSync(informerPath, "");

    writeSummary({
      metricsCsvPath: path.join(tmpDir, "nonexistent.csv"),
      informerLogPath: informerPath,
      failureReasonPath: failurePath,
      summaryPath,
    });

    const output = fs.readFileSync(summaryPath, "utf-8");
    expect(output).toContain("No metrics collected");
  });

  it("appends failure reason when failure file exists", () => {
    fs.writeFileSync(csvPath, "header\n1,2024-01-01T00:00:00Z,0,0,0\n");
    fs.writeFileSync(informerPath, "");
    fs.writeFileSync(failurePath, "Pod crashed after 30 minutes");

    writeSummary({
      metricsCsvPath: csvPath,
      informerLogPath: informerPath,
      failureReasonPath: failurePath,
      summaryPath,
    });

    const output = fs.readFileSync(summaryPath, "utf-8");
    expect(output).toContain("❌ Failure Reason");
    expect(output).toContain("Pod crashed after 30 minutes");
  });

  it("appends test passed when no failure file exists", () => {
    fs.writeFileSync(csvPath, "header\n1,2024-01-01T00:00:00Z,0,0,0\n");
    fs.writeFileSync(informerPath, "");

    writeSummary({
      metricsCsvPath: csvPath,
      informerLogPath: informerPath,
      failureReasonPath: failurePath,
      summaryPath,
    });

    const output = fs.readFileSync(summaryPath, "utf-8");
    expect(output).toContain("✅ Test Passed");
  });
});
