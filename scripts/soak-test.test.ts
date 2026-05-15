// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2024-Present The Pepr Authors

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { SoakTestFailure, initLogFiles } from "./soak-test.js";

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
