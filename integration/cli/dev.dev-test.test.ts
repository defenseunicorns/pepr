// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { Workdir } from "../helpers/workdir";
import * as time from "../helpers/time";
import * as pepr from "../helpers/pepr";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { fetch } from "kubernetes-fluent-client";
import { RequestInit, Agent } from "undici";

const FILE = path.basename(__filename);
const HERE = __dirname;
const five_mins = 1000 * 60 * 5;
let expectedLines = [
  "Establishing connection to Kubernetes",
  "Capability hello-pepr registered",
  "Mutate Action configured for CREATE",
  "Validate Action configured for CREATE",
  "Server listening on port 3000",
  "Controller startup complete",
];
let success = false;
describe("dev", { timeout: five_mins }, () => {
  const workdir = new Workdir(`${FILE}`, `${HERE}/../testroot/cli`);
  beforeAll(async () => {
    await workdir.recreate();
  }, time.toMs("1m"));

  describe("runs a module in dev mode", () => {
    const id = FILE.split(".").at(1);
    const testModule = `${workdir.path()}/${id}`;
    let cmd: ChildProcessWithoutNullStreams;

    beforeAll(async () => {
      await pepr.cli(workdir.path(), {
        cmd: `k3d cluster delete pepr-dev-cli && k3d cluster create pepr-dev-cli --k3s-arg '--debug@server:0' --wait && kubectl rollout status deployment -n kube-system`,
      });
      await fs.rm(testModule, { recursive: true, force: true });
      const argz = [
        `--name ${id}`,
        `--description ${id}`,
        `--error-behavior reject`,
        `--uuid dev-test`,
        "--yes",
        "--skip-post-init",
      ].join(" ");
      await pepr.cli(workdir.path(), { cmd: `pepr@nightly init ${argz}` });
      await pepr.tgzifyModule(testModule);
      await pepr.cli(testModule, { cmd: `npm install` });
    }, time.toMs("3m"));

    it("should start the pepr dev server", async () => {
      cmd = spawn("npx", ["pepr", "dev", "--yes"], { cwd: testModule, stdio: "pipe" });

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
    }, 180000);
    it("should be properly configured by the module ", async () => {
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
        }
      });
    });
    it("should be ready to accept requests", async () => {
      await waitForServer();
    });
    it("should protect the mutate and validate endpoints with an API path", async () => {
      await validateAPIPath();
    });
    it("should expose prometheus metrics", async () => {
      const metrics = await validateMetrics();
      expect(metrics).toMatch("pepr_validate");
      expect(metrics).toMatch("pepr_mutate");
      expect(metrics).toMatch("pepr_errors");
      expect(metrics).toMatch("pepr_alerts");
      expect(metrics).toMatch("pepr_mutate_sum");
      expect(metrics).toMatch("pepr_mutate_count");
      expect(metrics).toMatch("pepr_validate_sum");
      expect(metrics).toMatch("pepr_validate_count");
      expect(metrics).toMatch("pepr_cache_miss");
      expect(metrics).toMatch("pepr_resync_failure_count");
    });

    afterAll(async () => {
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
      await pepr.cli(workdir.path(), { cmd: `k3d cluster delete pepr-dev-cli` });
    });
  });
});

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

// Wait for the server to start and report healthy
async function waitForServer(): Promise<void> {
  const resp = await fetch(`${fetchBaseUrl}/healthz`, fetchOpts);
  if (!resp.ok) {
    await sleep(2);
    return waitForServer();
  }
}

async function validateAPIPath(): Promise<void> {
  const mutateUrl = `${fetchBaseUrl}/mutate/`;
  const validateUrl = `${fetchBaseUrl}/validate/`;
  const fetchPushOpts = { ...fetchOpts, method: "POST" };

  // Test for empty api path
  const emptyMutatePath = await fetch(mutateUrl, fetchPushOpts);
  expect(emptyMutatePath.status).toBe(404);
  const emptyValidatePath = await fetch(validateUrl, fetchPushOpts);
  expect(emptyValidatePath.status).toBe(404);

  // Test api path validation
  const evilMutatePath = await fetch(`${mutateUrl}evil-path`, fetchPushOpts);
  expect(evilMutatePath.status).toBe(401);
  const evilValidatePath = await fetch(`${validateUrl}evil-path`, fetchPushOpts);
  expect(evilValidatePath.status).toBe(401);
}

async function validateMetrics(): Promise<string> {
  const metricsOk = await fetch<string>(`${fetchBaseUrl}/metrics`, fetchOpts);
  expect(metricsOk.ok).toBe(true);

  return metricsOk.data;
}

function sleep(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}
