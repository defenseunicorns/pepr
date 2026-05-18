// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2024-Present The Pepr Authors

// Runs the soak test loop: collects metrics every 5 minutes and checks pod stability every 10 minutes.
// Produces logs/ artifacts consumed by soak-summary.ts.
//
// Usage: soak-test.ts

import fs from "node:fs";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

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

export function collectMetrics(logsDir: string = LOGS_DIR): void {
  const auditorOutput = execSync(
    "kubectl exec metrics-collector -n watch-auditor -- curl watch-auditor:8080/metrics",
    { timeout: KUBECTL_TIMEOUT_MS },
  ).toString();
  fs.writeFileSync(
    `${logsDir}/auditor-log.txt`,
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
    `${logsDir}/informer-log.txt`,
    informerOutput
      .split("\n")
      .filter(line => line.match(/pepr_cache_miss|pepr_resync_failure_count/))
      .join("\n"),
  );

  const watchOutput = execSync("kubectl logs deploy/pepr-soak-ci-watcher -n pepr-system", {
    timeout: KUBECTL_TIMEOUT_MS,
  }).toString();
  fs.writeFileSync(`${logsDir}/watch-logs.txt`, watchOutput);
}

export class SoakTestFailure extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "SoakTestFailure";
  }
}

export function failWithReason(reason: string, logsDir: string = LOGS_DIR): never {
  fs.writeFileSync(`${logsDir}/failure-reason.txt`, reason);
  try {
    collectMetrics(logsDir);
  } catch (e) {
    console.error("Failed to collect diagnostic metrics during failure handling:", e);
  }
  throw new SoakTestFailure(reason);
}

export function assertCacheMissGrowth(
  currentDelta: number,
  logsDir: string = LOGS_DIR,
  cacheMissGrowthThreshold: number = CACHE_MISS_GROWTH_THRESHOLD,
): void {
  const csvLines = fs.readFileSync(`${logsDir}/metrics.csv`, "utf-8").trim().split("\n");
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
  if (growth > cacheMissGrowthThreshold) {
    failWithReason(
      `Cache misses grew from ${baselineDelta} to ${currentDelta} (growth: ${growth} > threshold: ${cacheMissGrowthThreshold})`,
      logsDir,
    );
  }
}

function assertResyncFailures(columns: string[], threshold: number, logsDir: string): void {
  const currentResyncFailures = Number(columns[4] ?? 0);
  if (currentResyncFailures > threshold) {
    failWithReason(
      `Resync failures exceeded threshold: ${currentResyncFailures} > ${threshold}`,
      logsDir,
    );
  }
}

export function assertMetrics(
  iteration: number,
  logsDir: string = LOGS_DIR,
  resyncFailureThreshold: number = RESYNC_FAILURE_THRESHOLD,
  cacheMissGrowthThreshold: number = CACHE_MISS_GROWTH_THRESHOLD,
): void {
  const lastRow =
    fs.readFileSync(`${logsDir}/metrics.csv`, "utf-8").trim().split("\n").at(-1) ?? "";
  const columns = lastRow.split(",");

  const ctrlFailures = Number(columns[2] ?? 0);
  if (ctrlFailures !== 0) {
    failWithReason(`Watch controller failures detected: ${ctrlFailures}`, logsDir);
  }

  if (iteration > STABILIZATION_ITERATIONS) {
    assertCacheMissGrowth(Number(columns[3] ?? 0), logsDir, cacheMissGrowthThreshold);
  }

  assertResyncFailures(columns, resyncFailureThreshold, logsDir);
}

export function fetchPodNames(): string[] {
  const output = execSync("kubectl get pods -n pepr-demo -o jsonpath='{.items[*].metadata.name}'", {
    timeout: KUBECTL_TIMEOUT_MS,
  })
    .toString()
    .trim();

  if (!output) return [];

  return output.split(/\s+/).filter(Boolean);
}

export function checkPodStability(
  initialPods: Set<string>,
  elapsedMinutes: number,
  logsDir: string = LOGS_DIR,
): void {
  const currentPods = fetchPodNames();

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

  const recreated = currentPods.filter(pod => !initialPods.has(pod));
  if (recreated.length > 0) {
    try {
      execSync("kubectl logs deploy/pepr-soak-ci-watcher -n pepr-system", {
        stdio: "inherit",
        timeout: KUBECTL_TIMEOUT_MS,
      });
    } catch (e) {
      console.error("Failed to fetch watcher logs:", e);
    }
    failWithReason(
      `New pods detected (possible recreation) ~${elapsedMinutes} minutes into the run: ${recreated.join(", ")}`,
      logsDir,
    );
  }
}

export function initLogFiles(logsDir: string = LOGS_DIR): void {
  fs.mkdirSync(logsDir, { recursive: true });
  fs.writeFileSync(`${logsDir}/auditor-log.txt`, "");
  fs.writeFileSync(`${logsDir}/informer-log.txt`, "");
  fs.writeFileSync(`${logsDir}/watch-logs.txt`, "");
  fs.writeFileSync(
    `${logsDir}/metrics.csv`,
    "iteration,timestamp,watch_controller_failures_delta,pepr_cache_miss_delta,pepr_resync_failure_count\n",
  );
}

function runIteration(iteration: number, initialPods: Set<string>, elapsedMinutes: number): void {
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
    checkPodStability(initialPods, elapsedMinutes);
  }
}

async function main(): Promise<void> {
  initLogFiles();

  const initialPods = new Set(fetchPodNames());

  const startTime = Date.now();
  const endTime = startTime + TOTAL_DURATION_MS;
  let iteration = 0;

  try {
    while (Date.now() < endTime) {
      iteration++;
      const elapsedMinutes = Math.round((Date.now() - startTime) / 60_000);
      runIteration(iteration, initialPods, elapsedMinutes);

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

// CLI entry point — only runs when executed directly (not when imported).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error("Unexpected error:", err);
    process.exitCode = 1;
  });
}
