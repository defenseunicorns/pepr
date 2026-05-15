// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2024-Present The Pepr Authors

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  SoakTestFailure,
  assertCacheMissGrowth,
  assertMetrics,
  initLogFiles,
} from "./soak-test.js";
import { STABILIZATION_ITERATIONS } from "./soak-constants.js";

describe("SoakTestFailure", () => {
  it("has the correct name and message", () => {
    const err = new SoakTestFailure("something broke");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("SoakTestFailure");
    expect(err.message).toBe("something broke");
  });
});

describe("initLogFiles", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "soak-init-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates log directory and empty files", () => {
    const logsDir = path.join(tmpDir, "logs");
    initLogFiles(logsDir);

    expect(fs.existsSync(path.join(logsDir, "auditor-log.txt"))).toBe(true);
    expect(fs.existsSync(path.join(logsDir, "informer-log.txt"))).toBe(true);
    expect(fs.existsSync(path.join(logsDir, "watch-logs.txt"))).toBe(true);
    expect(fs.existsSync(path.join(logsDir, "metrics.csv"))).toBe(true);

    expect(fs.readFileSync(path.join(logsDir, "auditor-log.txt"), "utf-8")).toBe("");
    expect(fs.readFileSync(path.join(logsDir, "informer-log.txt"), "utf-8")).toBe("");
    expect(fs.readFileSync(path.join(logsDir, "watch-logs.txt"), "utf-8")).toBe("");
  });

  it("writes CSV header", () => {
    const logsDir = path.join(tmpDir, "logs");
    initLogFiles(logsDir);

    const csv = fs.readFileSync(path.join(logsDir, "metrics.csv"), "utf-8");
    expect(csv).toBe(
      "iteration,timestamp,watch_controller_failures_delta,pepr_cache_miss_delta,pepr_resync_failure_count\n",
    );
  });

  it("is idempotent (can be called on existing directory)", () => {
    const logsDir = path.join(tmpDir, "logs");
    initLogFiles(logsDir);
    initLogFiles(logsDir);

    expect(fs.existsSync(path.join(logsDir, "metrics.csv"))).toBe(true);
  });
});

describe("assertMetrics", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "soak-assert-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeCsv(rows: string[]): void {
    const header =
      "iteration,timestamp,watch_controller_failures_delta,pepr_cache_miss_delta,pepr_resync_failure_count";
    fs.writeFileSync(path.join(tmpDir, "metrics.csv"), [header, ...rows].join("\n") + "\n");
  }

  it("passes when all metrics are zero", () => {
    writeCsv(["1,2024-01-01T00:00:00Z,0,0,0"]);
    expect(() => assertMetrics(1, tmpDir)).not.toThrow();
  });

  it("fails when watch controller failures are non-zero", () => {
    writeCsv(["1,2024-01-01T00:00:00Z,3,0,0"]);
    expect(() => assertMetrics(1, tmpDir)).toThrow("Watch controller failures detected: 3");
  });

  it("fails when resync failures exceed threshold", () => {
    writeCsv(["1,2024-01-01T00:00:00Z,0,0,10"]);
    expect(() => assertMetrics(1, tmpDir, 5)).toThrow("Resync failures exceeded threshold: 10 > 5");
  });

  it("does not check cache miss growth before stabilization", () => {
    writeCsv(["1,2024-01-01T00:00:00Z,0,100,0"]);
    // iteration <= STABILIZATION_ITERATIONS, so cache miss growth is not checked
    expect(() => assertMetrics(1, tmpDir)).not.toThrow();
  });

  it("checks cache miss growth after stabilization", () => {
    // Need enough rows for stabilization baseline
    const rows: string[] = [];
    for (let i = 1; i <= STABILIZATION_ITERATIONS + 1; i++) {
      // Baseline at STABILIZATION_ITERATIONS has cache miss delta = 2
      const cacheDelta = i === STABILIZATION_ITERATIONS ? 2 : 0;
      rows.push(`${i},2024-01-01T00:00:00Z,0,${cacheDelta},0`);
    }
    // Final row with high cache miss delta
    rows.push(`${STABILIZATION_ITERATIONS + 2},2024-01-01T00:00:00Z,0,50,0`);
    writeCsv(rows);

    expect(() => assertMetrics(STABILIZATION_ITERATIONS + 2, tmpDir, 5, 10)).toThrow(
      "Cache misses grew",
    );
  });

  it("passes cache miss growth check when within threshold", () => {
    const rows: string[] = [];
    for (let i = 1; i <= STABILIZATION_ITERATIONS + 1; i++) {
      const cacheDelta = i === STABILIZATION_ITERATIONS ? 5 : 0;
      rows.push(`${i},2024-01-01T00:00:00Z,0,${cacheDelta},0`);
    }
    // Growth = 8 - 5 = 3, within default threshold of 10
    rows.push(`${STABILIZATION_ITERATIONS + 2},2024-01-01T00:00:00Z,0,8,0`);
    writeCsv(rows);

    expect(() => assertMetrics(STABILIZATION_ITERATIONS + 2, tmpDir, 5, 10)).not.toThrow();
  });
});

describe("assertCacheMissGrowth", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "soak-growth-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeCsv(rows: string[]): void {
    const header =
      "iteration,timestamp,watch_controller_failures_delta,pepr_cache_miss_delta,pepr_resync_failure_count";
    fs.writeFileSync(path.join(tmpDir, "metrics.csv"), [header, ...rows].join("\n") + "\n");
  }

  it("skips check when not enough CSV rows", () => {
    writeCsv(["1,2024-01-01T00:00:00Z,0,5,0"]);
    // Only 2 lines (header + 1 row), less than STABILIZATION_ITERATIONS
    expect(() => assertCacheMissGrowth(100, tmpDir, 10)).not.toThrow();
  });

  it("throws when growth exceeds threshold", () => {
    const rows: string[] = [];
    for (let i = 1; i <= STABILIZATION_ITERATIONS; i++) {
      const cacheDelta = i === STABILIZATION_ITERATIONS ? 3 : 0;
      rows.push(`${i},2024-01-01T00:00:00Z,0,${cacheDelta},0`);
    }
    writeCsv(rows);

    // currentDelta=20, baseline=3, growth=17 > threshold=10
    expect(() => assertCacheMissGrowth(20, tmpDir, 10)).toThrow(
      "Cache misses grew from 3 to 20 (growth: 17 > threshold: 10)",
    );
  });

  it("passes when growth is within threshold", () => {
    const rows: string[] = [];
    for (let i = 1; i <= STABILIZATION_ITERATIONS; i++) {
      const cacheDelta = i === STABILIZATION_ITERATIONS ? 3 : 0;
      rows.push(`${i},2024-01-01T00:00:00Z,0,${cacheDelta},0`);
    }
    writeCsv(rows);

    // currentDelta=8, baseline=3, growth=5 <= threshold=10
    expect(() => assertCacheMissGrowth(8, tmpDir, 10)).not.toThrow();
  });
});
