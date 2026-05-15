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
import { fetchPodNames, checkPodStability, collectMetrics, SoakTestFailure } from "./soak-test.js";

const mockExecSync = vi.mocked(execSync);

describe("collectMetrics", () => {
  let tmpDir: string;

  beforeEach(() => {
    mockExecSync.mockReset();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "soak-collect-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("filters auditor output to watch_controller_failures_total lines", () => {
    mockExecSync
      .mockReturnValueOnce(
        Buffer.from(
          "# HELP watch_controller_failures_total Total\n" +
            "# TYPE watch_controller_failures_total counter\n" +
            "watch_controller_failures_total 42\n" +
            "some_other_metric 99\n",
        ),
      )
      .mockReturnValueOnce(Buffer.from(""))
      .mockReturnValueOnce(Buffer.from("watch logs here"));

    collectMetrics(tmpDir);

    const auditor = fs.readFileSync(path.join(tmpDir, "auditor-log.txt"), "utf-8");
    expect(auditor).toContain("watch_controller_failures_total 42");
    expect(auditor).not.toContain("some_other_metric");
  });

  it("filters informer output to cache miss and resync lines", () => {
    mockExecSync
      .mockReturnValueOnce(Buffer.from(""))
      .mockReturnValueOnce(
        Buffer.from(
          'pepr_cache_miss{window="5m"} 10\n' +
            'pepr_resync_failure_count{count="0"} 1\n' +
            "unrelated_metric 5\n",
        ),
      )
      .mockReturnValueOnce(Buffer.from(""));

    collectMetrics(tmpDir);

    const informer = fs.readFileSync(path.join(tmpDir, "informer-log.txt"), "utf-8");
    expect(informer).toContain("pepr_cache_miss");
    expect(informer).toContain("pepr_resync_failure_count");
    expect(informer).not.toContain("unrelated_metric");
  });

  it("writes watch logs directly", () => {
    mockExecSync
      .mockReturnValueOnce(Buffer.from(""))
      .mockReturnValueOnce(Buffer.from(""))
      .mockReturnValueOnce(Buffer.from("full watch output"));

    collectMetrics(tmpDir);

    const watchLogs = fs.readFileSync(path.join(tmpDir, "watch-logs.txt"), "utf-8");
    expect(watchLogs).toBe("full watch output");
  });
});

describe("fetchPodNames", () => {
  beforeEach(() => {
    mockExecSync.mockReset();
  });

  it("returns pod names split by space", () => {
    mockExecSync.mockReturnValue(Buffer.from("pod-a pod-b pod-c"));
    const result = fetchPodNames();
    expect(result).toEqual(["pod-a", "pod-b", "pod-c"]);
  });

  it("returns empty array when output is empty", () => {
    mockExecSync.mockReturnValue(Buffer.from(""));
    const result = fetchPodNames();
    expect(result).toEqual([]);
  });

  it("returns single pod name", () => {
    mockExecSync.mockReturnValue(Buffer.from("only-pod"));
    const result = fetchPodNames();
    expect(result).toEqual(["only-pod"]);
  });

  it("trims whitespace from output", () => {
    mockExecSync.mockReturnValue(Buffer.from("  pod-a pod-b  "));
    const result = fetchPodNames();
    expect(result).toEqual(["pod-a", "pod-b"]);
  });
});

describe("checkPodStability", () => {
  let tmpDir: string;

  beforeEach(() => {
    mockExecSync.mockReset();
    // Default: return empty pod list for fetchPodNames, no-op for display commands
    mockExecSync.mockReturnValue(Buffer.from(""));
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "soak-stability-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("does not throw when all pods are in the initial set", () => {
    mockExecSync.mockReturnValue(Buffer.from("pod-a pod-b"));

    const initialPods = new Set(["pod-a", "pod-b"]);
    expect(() => checkPodStability(initialPods, 10, tmpDir)).not.toThrow();
  });

  it("does not throw when current pods are a subset of initial", () => {
    mockExecSync.mockReturnValue(Buffer.from("pod-a"));

    const initialPods = new Set(["pod-a", "pod-b"]);
    expect(() => checkPodStability(initialPods, 10, tmpDir)).not.toThrow();
  });

  it("throws SoakTestFailure when a new pod appears", () => {
    mockExecSync.mockReturnValue(Buffer.from("pod-a pod-new"));

    const initialPods = new Set(["pod-a", "pod-b"]);
    expect(() => checkPodStability(initialPods, 15, tmpDir)).toThrow(SoakTestFailure);
  });

  it("reports all recreated pods in a single error", () => {
    mockExecSync.mockReturnValue(Buffer.from("pod-a pod-new-1 pod-new-2"));

    const initialPods = new Set(["pod-a"]);
    expect(() => checkPodStability(initialPods, 30, tmpDir)).toThrow(
      "New pods detected (possible recreation) ~30 minutes into the run: pod-new-1, pod-new-2",
    );
  });

  it("does not throw when no pods are running", () => {
    mockExecSync.mockReturnValue(Buffer.from(""));

    const initialPods = new Set(["pod-a"]);
    expect(() => checkPodStability(initialPods, 5, tmpDir)).not.toThrow();
  });
});
