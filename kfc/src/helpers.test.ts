// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Kubernetes Fluent Client Authors

import { describe, expect, it, test } from "@jest/globals";

import { fromEnv, hasLogs, waitForCluster } from "./helpers";

describe("helpers", () => {
  test("fromEnv for NodeJS", () => {
    expect(() => {
      fromEnv("MY_MISSING_ENV_VAR");
    }).toThrowError("Environment variable MY_MISSING_ENV_VAR is not set");

    process.env.MY_ENV_VAR = "my-value";
    expect(fromEnv("MY_ENV_VAR")).toEqual("my-value");
    delete process.env.MY_ENV_VAR;
  });
});

describe("Cluster Wait Function", () => {
  it("should resolve if the cluster is already ready", async () => {
    const cluster = await waitForCluster(5);
    expect(cluster).toEqual({ server: "http://jest-test:8080" });
  });
});

describe("hasLogs function", () => {
  it("should return true for known kinds", () => {
    expect(hasLogs("Pod")).toBe(true);
    expect(hasLogs("DaemonSet")).toBe(true);
    expect(hasLogs("ReplicaSet")).toBe(true);
    expect(hasLogs("Service")).toBe(true);
    expect(hasLogs("StatefulSet")).toBe(true);
    expect(hasLogs("Deployment")).toBe(true);
  });

  it("should return false for unknown kinds", () => {
    expect(hasLogs("Unknown")).toBe(false);
    expect(hasLogs("")).toBe(false);
    expect(hasLogs("RandomKind")).toBe(false);
  });
});
