// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2024-Present The Pepr Authors

// Tests for kubectl-dependent functions using mocked child_process.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

import { execSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import {
  fetchPodNames,
  checkPodStability,
  failWithReason,
  assertMetrics,
  SoakTestFailure,
} from "./soak-test.js";
import { STABILIZATION_ITERATIONS } from "./soak-constants.js";

const mockExecSync = vi.mocked(execSync);

describe("fetchPodNames", () => {
  beforeEach(() => {
    mockExecSync.mockReset();
  });

  it.each([
    {
      input: "pod-a pod-b pod-c",
      expected: ["pod-a", "pod-b", "pod-c"],
      desc: "splits multiple pod names",
    },
    { input: "", expected: [], desc: "returns empty array for empty output" },
    {
      input: "  pod-a pod-b  ",
      expected: ["pod-a", "pod-b"],
      desc: "handles leading/trailing whitespace",
    },
  ])("$desc", ({ input, expected }) => {
    mockExecSync.mockReturnValue(Buffer.from(input));

    const result = fetchPodNames();

    expect(result).toEqual(expected);
  });
});

describe("failWithReason", () => {
  let tmpDir: string;

  beforeEach(() => {
    mockExecSync.mockReset();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "soak-fail-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes reason to file and throws SoakTestFailure with that reason", () => {
    expect(() => failWithReason("pod crashed", tmpDir)).toThrow(SoakTestFailure);
    expect(fs.readFileSync(path.join(tmpDir, "failure-reason.txt"), "utf-8")).toBe("pod crashed");
  });
});

describe("checkPodStability", () => {
  let tmpDir: string;

  beforeEach(() => {
    mockExecSync.mockReset();
    mockExecSync.mockReturnValue(Buffer.from(""));
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "soak-stability-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("does not throw when each pod name is only seen once", () => {
    mockExecSync.mockReturnValue(Buffer.from("pod-a pod-b"));
    const podMap = new Map<string, number>();

    expect(() => checkPodStability(podMap, 10, tmpDir)).not.toThrow();
  });

  it("does not throw for new uniquely-named pods across checks", () => {
    const podMap = new Map<string, number>();

    mockExecSync.mockReturnValue(Buffer.from("auto-abc"));
    checkPodStability(podMap, 10, tmpDir);

    mockExecSync.mockReturnValue(Buffer.from("auto-def"));
    expect(() => checkPodStability(podMap, 20, tmpDir)).not.toThrow();
  });

  it("throws SoakTestFailure when a pod name is seen more than once", () => {
    const podMap = new Map<string, number>();

    mockExecSync.mockReturnValue(Buffer.from("pod-a"));
    checkPodStability(podMap, 10, tmpDir);

    mockExecSync.mockReturnValue(Buffer.from("pod-a"));
    expect(() => checkPodStability(podMap, 20, tmpDir)).toThrow(
      "Pod recreation detected ~20 minutes into the run: pod-a (seen 2 times)",
    );
  });
});

describe("assertMetrics", () => {
  let tmpDir: string;

  beforeEach(() => {
    mockExecSync.mockReset();
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

  it("skips cache miss growth check before stabilization, enforces it after", () => {
    const rows: string[] = [];
    for (let i = 1; i <= STABILIZATION_ITERATIONS + 1; i++) {
      const cacheDelta = i === STABILIZATION_ITERATIONS ? 2 : 0;
      rows.push(`${i},2024-01-01T00:00:00Z,0,${cacheDelta},0`);
    }
    rows.push(`${STABILIZATION_ITERATIONS + 2},2024-01-01T00:00:00Z,0,50,0`);
    writeCsv(rows);

    expect(() => assertMetrics(1, tmpDir)).not.toThrow();
    expect(() => assertMetrics(STABILIZATION_ITERATIONS + 2, tmpDir, 5, 10)).toThrow(
      "Cache misses grew",
    );
  });
});
