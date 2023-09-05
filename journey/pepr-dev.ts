// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { afterAll, expect, it } from "@jest/globals";
import { KubeConfig } from "@kubernetes/client-node";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { Agent } from "https";
import { RequestInit } from "node-fetch";

import { fetch } from "../src/lib/fetch";
import { cwd } from "./entrypoint.test";

const kc = new KubeConfig();
kc.loadFromDefault();

let expectedLines = [
  "Establishing connection to Kubernetes",
  "Capability hello-pepr registered",
  "Mutate Action configured for CREATE",
  "Validate Action configured for CREATE",
  "Server listening on port 3000",
];

export function peprDev() {
  let cmd: ChildProcessWithoutNullStreams;
  let success = false;

  it("should start the Pepr dev server", () => {
    cmd = spawn("npx", ["pepr", "dev", "--confirm"], { cwd });

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
      console.log(strData);

      // Check if any expected lines are found
      expectedLines = expectedLines.filter(expectedLine => {
        // Check if the expected line is found in the output, ignoring whitespace
        return !strData.replace(/\s+/g, " ").includes(expectedLine);
      });

      // If all expected lines are found, resolve the promise
      if (expectedLines.length < 1) {
        // Abort all further processing
        success = true;

        // Finish the test
        done();
      }
    });
  });

  it("should protect the controller endpoint with an API token", async () => {
    await validateAPIKey();
  });

  it("should expose Prometheus metrics", async () => {
    const metrics = await validateMetrics();
    expect(metrics).toMatch("pepr_Validate");
    expect(metrics).toMatch("pepr_Mutate");
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

async function validateAPIKey() {
  const base = "https://localhost:3000/mutate/";

  const fetchOpts: RequestInit = {
    agent: new Agent({
      // Avoid tls issues for self-signed certs
      rejectUnauthorized: false,
    }),
    method: "POST",
  };

  // Test api token validation
  const evilToken = await fetch(`${base}evil-token`, fetchOpts);

  // Test for empty api token
  const emptyToken = await fetch(base, fetchOpts);

  if (evilToken.status !== 401) {
    throw new Error("Expected evil token to return 401");
  }

  if (emptyToken.status !== 404) {
    throw new Error("Expected empty token to return 404");
  }
}

async function validateMetrics() {
  const metricsEndpoint = "https://localhost:3000/metrics";

  const fetchOpts: RequestInit = {
    agent: new Agent({
      // Avoid tls issues for self-signed certs
      rejectUnauthorized: false,
    }),
  };
  const metricsOk = await fetch<string>(metricsEndpoint, fetchOpts);

  if (metricsOk.status !== 200) {
    throw new Error("Expected metrics ok to return a 200");
  }

  return metricsOk.data;
}
