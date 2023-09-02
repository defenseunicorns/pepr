// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { KubeConfig } from "@kubernetes/client-node";
import { ExecutionContext } from "ava";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { cwd } from "./entrypoint.test";

const kc = new KubeConfig();
kc.loadFromDefault();

// Timeout in milliseconds
const TIMEOUT = 120 * 1000;

let expectedLines = [
  "Establishing connection to Kubernetes",
  "Capability hello-pepr registered",
  "Mutate Action configured for CREATE",
  "Validate Action configured for CREATE",
  "Server listening on port 3000",
];

export async function peprDev(t: ExecutionContext) {
  try {
    const cmd = await new Promise<ChildProcessWithoutNullStreams>(runner);

    await validateAPIKey();

    const metrics = await validateMetrics();
    t.is(metrics.includes("pepr_Validate"), true);
    t.is(metrics.includes("pepr_Mutate"), true);
    t.is(metrics.includes("pepr_errors"), true);
    t.is(metrics.includes("pepr_alerts"), true);
    t.log("Validated metrics endpoint");

    cmd.kill();
    t.pass();
  } catch (e) {
    t.fail(e.message);
  }
}

function runner(resolve, reject): ChildProcessWithoutNullStreams {
  const cmd = spawn("npx", ["pepr", "dev", "--confirm"], { cwd });

  cmd.stdout.on("data", (data: Buffer) => {
    // Convert buffer to string
    const strData = data.toString();
    console.log(strData);

    // Check if any expected lines are found
    expectedLines = expectedLines.filter(expectedLine => {
      // Check if the expected line is found in the output, ignoring whitespace
      return !strData.replace(/\s+/g, " ").includes(expectedLine);
    });

    console.log(
      "\x1b[36m%s\x1b[0m'",
      "Remaining expected lines:" + JSON.stringify(expectedLines, null, 2),
    );

    // If all expected lines are found, resolve the promise
    if (expectedLines.length < 1) {
      resolve(cmd);
    }
  });

  // Log stderr
  cmd.stderr.on("data", data => {
    console.error(`stderr: ${data}`);
  });

  // This command should not exit on its own
  cmd.on("close", code => {
    reject(new Error(`Command exited with code ${code}`));
  });

  // Reject on error
  cmd.on("error", error => {
    reject(error);
  });

  // Reject on timeout
  setTimeout(() => {
    console.error("Remaining expected lines:" + JSON.stringify(expectedLines, null, 2));
    cmd.kill();
    reject(new Error("Timeout: Expected lines not found"));
  }, TIMEOUT);

  return cmd;
}

async function validateAPIKey() {
  // Ignore TLS verification
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const base = "https://localhost:3000/mutate/";

  // Test api token validation
  const evilToken = await fetch(`${base}evil-token`, { method: "POST" });

  // Test for empty api token
  const emptyToken = await fetch(base, { method: "POST" });

  if (evilToken.status !== 401) {
    throw new Error("Expected evil token to return 401");
  }

  if (emptyToken.status !== 404) {
    throw new Error("Expected empty token to return 404");
  }

  // Restore TLS verification
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";
}

async function validateMetrics() {
  // Ignore TLS verification
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const metricsEndpoint = "https://localhost:3000/metrics";

  const metricsOk = await fetch(metricsEndpoint);

  if (metricsOk.status !== 200) {
    throw new Error("Expected metrics ok to return a 200");
  }
  // Restore TLS verification
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";

  return await metricsOk.text();
}
