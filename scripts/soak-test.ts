// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2024-Present The Pepr Authors

// Runs the soak test loop: collects metrics every 5 minutes and checks pod stability every 10 minutes.
// Produces logs/ artifacts consumed by soak-summary.ts.
//
// Usage: soak-test.ts

import fs from "node:fs";
import { execSync } from "node:child_process";

import { recordMetrics } from "./soak-record-metrics.js";
import {
  INTERVAL_MS,
  TOTAL_DURATION_MS,
  STABILIZATION_ITERATIONS,
  POD_CHECK_INTERVAL,
  KUBECTL_TIMEOUT_MS,
  parseEnvNumber,
} from "./soak-constants.js";

const LOGS_DIR = "logs";

// Metric assertion thresholds (configurable via environment)
const CACHE_MISS_GROWTH_THRESHOLD = parseEnvNumber(process.env.CACHE_MISS_GROWTH_THRESHOLD, 10);
const RESYNC_FAILURE_THRESHOLD = parseEnvNumber(process.env.RESYNC_FAILURE_THRESHOLD, 5);

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

function collectMetrics(): void {
  const auditorOutput = execSync(
    "kubectl exec metrics-collector -n watch-auditor -- curl watch-auditor:8080/metrics",
    { timeout: KUBECTL_TIMEOUT_MS },
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
    { timeout: KUBECTL_TIMEOUT_MS },
  ).toString();
  fs.writeFileSync(
    `${LOGS_DIR}/informer-log.txt`,
    informerOutput
      .split("\n")
      .filter(line => line.match(/pepr_cache_miss|pepr_resync_failure_count/))
      .join("\n"),
  );

  const watchOutput = execSync("kubectl logs deploy/pepr-soak-ci-watcher -n pepr-system", {
    timeout: KUBECTL_TIMEOUT_MS,
  }).toString();
  fs.writeFileSync(`${LOGS_DIR}/watch-logs.txt`, watchOutput);
}

function checkPod(pod: string, count: number, elapsedMinutes: number): void {
  console.log(`${pod}: ${count}`);
  if (count > 1) {
    console.log(`Test failed: Pod ${pod} has count ${count}`);
    try {
      execSync("kubectl logs deploy/pepr-soak-ci-watcher -n pepr-system", {
        stdio: "inherit",
        timeout: KUBECTL_TIMEOUT_MS,
      });
    } catch (e) {
      console.error("Failed to fetch watcher logs:", e);
    }
    failWithReason(
      `Pod ${pod} was recreated (seen ${count} times) ~${elapsedMinutes} minutes into the run`,
    );
  }
}

class SoakTestFailure extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "SoakTestFailure";
  }
}

function failWithReason(reason: string): never {
  fs.writeFileSync(`${LOGS_DIR}/failure-reason.txt`, reason);
  try {
    collectMetrics();
  } catch (e) {
    console.error("Failed to collect final metrics:", e);
  }
  throw new SoakTestFailure(reason);
}

function assertCacheMissGrowth(currentDelta: number): void {
  const csvLines = fs.readFileSync(`${LOGS_DIR}/metrics.csv`, "utf-8").trim().split("\n");
  if (csvLines.length <= STABILIZATION_ITERATIONS) {
    console.warn(
      `Not enough CSV rows (${csvLines.length}) to compute baseline at iteration ${STABILIZATION_ITERATIONS}`,
    );
    return;
  }
  // line index STABILIZATION_ITERATIONS = that iteration row (header is index 0)
  const baselineColumns = (csvLines[STABILIZATION_ITERATIONS] ?? "").split(",");
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
  const ctrlFailures = Number(columns[2] ?? 0);
  if (ctrlFailures !== 0) {
    failWithReason(`Watch controller failures detected: ${ctrlFailures}`);
  }

  // After stabilization, assert cache misses are not growing
  if (iteration > STABILIZATION_ITERATIONS) {
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

function updatePodMap(podMap: Map<string, number>): void {
  const output = execSync("kubectl get pods -n pepr-demo -o jsonpath='{.items[*].metadata.name}'", {
    timeout: KUBECTL_TIMEOUT_MS,
  })
    .toString()
    .trim();

  if (!output) return;

  for (const pod of output.split(" ")) {
    podMap.set(pod, (podMap.get(pod) ?? 0) + 1);
  }
}

function checkPodStability(podMap: Map<string, number>, elapsedMinutes: number): void {
  updatePodMap(podMap);

  execSync("kubectl get pods -n pepr-demo", {
    stdio: "inherit",
    timeout: KUBECTL_TIMEOUT_MS,
  });
  execSync("kubectl top pods -n pepr-system", {
    stdio: "inherit",
    timeout: KUBECTL_TIMEOUT_MS,
  });
  execSync("kubectl get pods -n pepr-system", {
    stdio: "inherit",
    timeout: KUBECTL_TIMEOUT_MS,
  });

  for (const [pod, count] of podMap) {
    checkPod(pod, count, elapsedMinutes);
  }
}

function initLogFiles(): void {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  fs.writeFileSync(`${LOGS_DIR}/auditor-log.txt`, "");
  fs.writeFileSync(`${LOGS_DIR}/informer-log.txt`, "");
  fs.writeFileSync(`${LOGS_DIR}/watch-logs.txt`, "");
  fs.writeFileSync(
    `${LOGS_DIR}/metrics.csv`,
    "iteration,timestamp,watch_controller_failures_delta,pepr_cache_miss_delta,pepr_resync_failure_count\n",
  );
}

function runIteration(
  iteration: number,
  podMap: Map<string, number>,
  elapsedMinutes: number,
): void {
  collectMetrics();

  console.log(fs.readFileSync(`${LOGS_DIR}/informer-log.txt`, "utf-8"));
  console.log(fs.readFileSync(`${LOGS_DIR}/auditor-log.txt`, "utf-8"));

  recordMetrics({
    iteration,
    auditorLogPath: `${LOGS_DIR}/auditor-log.txt`,
    informerLogPath: `${LOGS_DIR}/informer-log.txt`,
    metricsCsvPath: `${LOGS_DIR}/metrics.csv`,
  });

  assertMetrics(iteration);

  if (iteration % POD_CHECK_INTERVAL === 0) {
    checkPodStability(podMap, elapsedMinutes);
  }
}

async function main(): Promise<void> {
  initLogFiles();

  const podMap = new Map<string, number>();
  updatePodMap(podMap);

  const startTime = Date.now();
  const endTime = startTime + TOTAL_DURATION_MS;
  let iteration = 0;

  try {
    while (Date.now() < endTime) {
      iteration++;
      const elapsedMinutes = Math.round((Date.now() - startTime) / 60_000);
      runIteration(iteration, podMap, elapsedMinutes);

      if (Date.now() < endTime) {
        await sleep(INTERVAL_MS);
      }
    }

    console.log("Soak test passed successfully!");
  } catch (err) {
    if (err instanceof SoakTestFailure) {
      console.error(err.message);
      process.exitCode = 1;
    } else {
      // Write failure reason for unexpected errors so the summary step has diagnostics
      const message = err instanceof Error ? err.message : String(err);
      fs.writeFileSync(`${LOGS_DIR}/failure-reason.txt`, `Unexpected error: ${message}`);
      throw err;
    }
  }
}

main().catch(err => {
  console.error("Unexpected error:", err);
  process.exitCode = 1;
});
