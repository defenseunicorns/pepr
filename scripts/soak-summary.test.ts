// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2024-Present The Pepr Authors

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { buildSummaryLines, writeSummary } from "./soak-summary.js";

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

  it("reports zero failures as passing", () => {
    fs.writeFileSync(informerPath, 'pepr_resync_failure_count{count="0"} 1\n');
    const csvLines = [
      "iteration,timestamp,watch_controller_failures_delta,pepr_cache_miss_delta,pepr_resync_failure_count",
      "1,2024-01-01T00:00:00Z,0,0,0",
    ];

    const output = buildSummaryLines(csvLines, informerPath).join("\n");

    expect(output).toContain("watch_controller_failures_total");
    expect(output).toContain("| 0 |");
    expect(output).not.toContain("❌");
  });

  it("reports non-zero controller failures as failing", () => {
    fs.writeFileSync(informerPath, "");
    const csvLines = ["header", "1,2024-01-01T00:00:00Z,3,0,0"];

    const output = buildSummaryLines(csvLines, informerPath).join("\n");

    expect(output).toContain("| 3 |");
    expect(output).toContain("❌");
  });

  it("breaks down cache misses into startup vs mid-run when non-zero", () => {
    fs.writeFileSync(informerPath, "");
    const csvLines = ["header", "1,2024-01-01T00:00:00Z,0,5,0", "2,2024-01-01T00:05:00Z,0,3,0"];

    const output = buildSummaryLines(csvLines, informerPath).join("\n");

    expect(output).toContain("8 total (5 startup, 3 mid-run)");
  });

  it("reports non-zero resync failures as failing", () => {
    fs.writeFileSync(informerPath, 'pepr_resync_failure_count{count="2"} 1\n');
    const csvLines = ["header", "1,2024-01-01T00:00:00Z,0,0,5"];

    const output = buildSummaryLines(csvLines, informerPath).join("\n");

    expect(output).toContain("5 failures across");
    expect(output).toContain("❌");
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

  it.each([
    { desc: "CSV has only a header", csvContent: "header\n" },
    { desc: "CSV does not exist", csvContent: null },
  ])("writes 'No metrics collected' when $desc", ({ csvContent }) => {
    if (csvContent !== null) {
      fs.writeFileSync(csvPath, csvContent);
    }
    fs.writeFileSync(informerPath, "");
    const effectiveCsvPath = csvContent === null ? path.join(tmpDir, "nonexistent.csv") : csvPath;

    writeSummary({
      metricsCsvPath: effectiveCsvPath,
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
    expect(output).toContain("Failure Reason");
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
    expect(output).toContain("Test Passed");
  });
});
