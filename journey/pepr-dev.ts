// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { afterAll, expect, it } from "@jest/globals";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { fetch } from "kubernetes-fluent-client";
import { RequestInit, Agent } from "undici";
import { cwd } from "./entrypoint.test";
import { sleep } from "./k8s";

const fetchBaseUrl = "https://localhost:3000";
const fetchOpts: RequestInit = {
  method: "GET",
  headers: {
    "Content-Type": "application/json; charset=UTF-8",
  },
  dispatcher: new Agent({
    // disable keep-alive https://github.com/nodejs/undici/issues/2522#issuecomment-1859213319
    pipelining: 0,
    connect: {
      rejectUnauthorized: false,
    },
  }),
};

let expectedLines = [
  "Establishing connection to Kubernetes",
  "Capability hello-pepr registered",
  "Mutate Action configured for CREATE",
  "Validate Action configured for CREATE",
  "Server listening on port 3000",
  "Controller startup complete",
  `"hello-pepr-v2-example-1-data": "{\\"key\\":\\"ex-1-val\\"}"`,
  `"hello-pepr-v2-watch-data": "This data was stored by a Watch Action."`,
];

export function peprDev() {
  let cmd: ChildProcessWithoutNullStreams;
  let success = false;

  it("should start the Pepr dev server", () => {
    cmd = spawn("npx", ["pepr", "dev", "--confirm"], { cwd, stdio: "pipe" });

    // This command should not exit on its own
    cmd.on("close", code => {
      if (!success) {
        throw new Error(`Command exited with code ${code}`);
      }
    });

    // Log stderr
    cmd.stderr.on("data", data => {
      if (!success) {
        console.error(`stderr: ${data}`);
      }
    });

    // Reject on error
    cmd.on("error", error => {
      if (!success) {
        throw error;
      }
    });
  });

  it("should be properly configured by the test module", done => {
    cmd.stdout.on("data", (data: Buffer) => {
      if (success) {
        return;
      }

      // Convert buffer to string
      const strData = data.toString();

      // Check if any expected lines are found
      expectedLines = expectedLines.filter(expectedLine => {
        // Check if the expected line is found in the output, ignoring whitespace
        return !strData.replace(/\s+/g, " ").includes(expectedLine);
      });

      // If all expected lines are found, resolve the promise
      if (expectedLines.length > 0) {
        console.log(`still waiting on ${expectedLines.length} lines...`);
      } else {
        // Abort all further processing
        success = true;
        // Finish the test
        done();
      }
    });
  });

  it("should be ready to accept requests", async () => {
    await waitForServer();
  });

  it("should protect the controller mutate & validate endpoint with an API token", async () => {
    await validateAPIKey();
  });

  it("should expose Prometheus metrics", async () => {
    const metrics = await validateMetrics();
    expect(metrics).toMatch("pepr_validate");
    expect(metrics).toMatch("pepr_mutate");
    expect(metrics).toMatch("pepr_errors");
    expect(metrics).toMatch("pepr_alerts");
  });

  afterAll(() => {
    // Close or destroy the streams
    if (cmd.stdin) {
      cmd.stdin.end();
    }
    if (cmd.stdout) {
      cmd.stdout.destroy();
    }
    if (cmd.stderr) {
      cmd.stderr.destroy();
    }

    // Remove the event listeners
    cmd.removeAllListeners("close");
    cmd.removeAllListeners("error");

    // Kill the process
    cmd.kill(9);
  });
}

// Wait for the server to start and report healthy
async function waitForServer() {
  const resp = await fetch(`${fetchBaseUrl}/healthz`, fetchOpts);
  if (!resp.ok) {
    await sleep(2);
    return waitForServer();
  }
}

async function validateAPIKey() {
  const mutateUrl = `${fetchBaseUrl}/mutate/`;
  const validateUrl = `${fetchBaseUrl}/validate/`;
  const fetchPushOpts = { ...fetchOpts, method: "POST" };

  // Test for empty api token
  const emptyMutateToken = await fetch(mutateUrl, fetchPushOpts);
  expect(emptyMutateToken.status).toBe(404);
  const emptyValidateToken = await fetch(validateUrl, fetchPushOpts);
  expect(emptyValidateToken.status).toBe(404);

  // Test api token validation
  const evilMutateToken = await fetch(`${mutateUrl}evil-token`, fetchPushOpts);
  expect(evilMutateToken.status).toBe(401);
  const evilValidateToken = await fetch(`${validateUrl}evil-token`, fetchPushOpts);
  expect(evilValidateToken.status).toBe(401);
}

async function validateMetrics() {
  const metricsOk = await fetch<string>(`${fetchBaseUrl}/metrics`, fetchOpts);
  expect(metricsOk.ok).toBe(true);

  return metricsOk.data;
}
