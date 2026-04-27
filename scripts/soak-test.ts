// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2024-Present The Pepr Authors

// Runs the soak test loop: collects metrics every 5 minutes and checks pod stability every 10 minutes.
// Produces logs/ artifacts consumed by soak-summary.ts.
//
// Usage: soak-test.ts

import fs from "node:fs";
import path from "node:path";
import { execFileSync, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = "logs";
const SCRIPT_DIR = __dirname;

// Metric assertion thresholds (configurable via environment)
const CACHE_MISS_GROWTH_THRESHOLD = Number(process.env.CACHE_MISS_GROWTH_THRESHOLD) || 10;
const RESYNC_FAILURE_THRESHOLD = Number(process.env.RESYNC_FAILURE_THRESHOLD) || 5;

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

fs.mkdirSync(LOGS_DIR, { recursive: true });
fs.writeFileSync(`${LOGS_DIR}/auditor-log.txt`, "");
fs.writeFileSync(`${LOGS_DIR}/informer-log.txt`, "");
fs.writeFileSync(`${LOGS_DIR}/watch-logs.txt`, "");
fs.writeFileSync(
  `${LOGS_DIR}/metrics.csv`,
  "iteration,timestamp,watch_controller_failures_delta,pepr_cache_miss_delta,pepr_resync_failure_count\n",
);

const podMap = new Map<string, number>();

function updatePodMap(): void {
  const output = execSync("kubectl get pods -n pepr-demo -o jsonpath='{.items[*].metadata.name}'")
    .toString()
    .trim();

  if (!output) return;

  for (const pod of output.split(" ")) {
    podMap.set(pod, (podMap.get(pod) ?? 0) + 1);
  }
}

function collectMetrics(): void {
  const auditorOutput = execSync(
    "kubectl exec metrics-collector -n watch-auditor -- curl watch-auditor:8080/metrics",
  ).toString();
  fs.writeFileSync(
    `${LOGS_DIR}/auditor-log.txt`,
    auditorOutput
      .split("\n")
      .filter(line => line.includes("watch_controller_failures_total"))
      .join("\n"),
  );

  const informerOutput = execSync(
    "kubectl exec metrics-collector -n watch-auditor -- curl -k https://pepr-soak-ci-watcher.pepr-system.svc.cluster.local/metrics",
  ).toString();
  fs.writeFileSync(
    `${LOGS_DIR}/informer-log.txt`,
    informerOutput
      .split("\n")
      .filter(line => line.match(/pepr_cache_miss|pepr_resync_failure_count/))
      .join("\n"),
  );

  execSync(`kubectl logs deploy/pepr-soak-ci-watcher -n pepr-system > ${LOGS_DIR}/watch-logs.txt`, {
    shell: "/bin/bash",
  });
}

function checkPod(pod: string, count: number, iteration: number): void {
  console.log(`${pod}: ${count}`);
  if (count > 1) {
    console.log(`Test failed: Pod ${pod} has count ${count}`);
    fs.writeFileSync(
      `${LOGS_DIR}/failure-reason.txt`,
      `Pod ${pod} was recreated (seen ${count} times) at iteration ${iteration} (~${iteration * 5} minutes into the run.`,
    );
    execSync("kubectl logs deploy/pepr-soak-ci-watcher -n pepr-system", { stdio: "inherit" });
    process.exit(1);
  }
}

function failWithReason(reason: string): never {
  fs.writeFileSync(`${LOGS_DIR}/failure-reason.txt`, reason);
  collectMetrics();
  process.exit(1);
}

function assertCacheMissGrowth(currentDelta: number): void {
  const csvLines = fs.readFileSync(`${LOGS_DIR}/metrics.csv`, "utf-8").trim().split("\n");
  const baselineColumns = (csvLines[14] ?? "").split(","); // line index 14 = iteration 14 (header is index 0)
  const baselineDelta = Number(baselineColumns[3] ?? 0);
  const growth = currentDelta - baselineDelta;
  if (growth > CACHE_MISS_GROWTH_THRESHOLD) {
    failWithReason(
      `Cache misses grew from ${baselineDelta} to ${currentDelta} (growth: ${growth} > threshold: ${CACHE_MISS_GROWTH_THRESHOLD})`,
    );
  }
}

function assertMetrics(iteration: number): void {
  const lastRow =
    fs.readFileSync(`${LOGS_DIR}/metrics.csv`, "utf-8").trim().split("\n").at(-1) ?? "";
  const columns = lastRow.split(",");

  // Assert watch controller has no failures
  const ctrlFailures = columns[2] ?? "0";
  if (ctrlFailures !== "0") {
    failWithReason(`Watch controller failures detected: ${ctrlFailures}`);
  }

  // After stabilization (~70 minutes), assert cache misses are not growing
  if (iteration > 14) {
    assertCacheMissGrowth(Number(columns[3] ?? 0));
  }

  // Assert resync failures stay below threshold
  const currentResyncFailures = Number(columns[4] ?? 0);
  if (currentResyncFailures > RESYNC_FAILURE_THRESHOLD) {
    failWithReason(
      `Resync failures exceeded threshold: ${currentResyncFailures} > ${RESYNC_FAILURE_THRESHOLD}`,
    );
  }
}

function checkPodStability(iteration: number): void {
  updatePodMap();

  execSync("kubectl get pods -n pepr-demo", { stdio: "inherit" });
  execSync("kubectl top po -n pepr-system", { stdio: "inherit" });
  execSync("kubectl get po -n pepr-system", { stdio: "inherit" });

  for (const [pod, count] of podMap) {
    checkPod(pod, count, iteration);
  }
}

async function main(): Promise<void> {
  updatePodMap();

  for (let i = 1; i <= 70; i++) {
    collectMetrics();

    console.log(fs.readFileSync(`${LOGS_DIR}/informer-log.txt`, "utf-8"));
    console.log(fs.readFileSync(`${LOGS_DIR}/auditor-log.txt`, "utf-8"));

    execFileSync(
      "npx",
      [
        "tsx",
        path.join(SCRIPT_DIR, "soak-record-metrics.ts"),
        String(i),
        `${LOGS_DIR}/auditor-log.txt`,
        `${LOGS_DIR}/informer-log.txt`,
        `${LOGS_DIR}/metrics.csv`,
      ],
      { stdio: "inherit" },
    );

    assertMetrics(i);

    if (i % 2 === 0) {
      checkPodStability(i);
    }

    await sleep(300_000);
  }

  console.log("Soak test passed successfully!");
}

void main();
