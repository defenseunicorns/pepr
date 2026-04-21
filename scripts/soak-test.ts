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

    if (i % 2 === 0) {
      updatePodMap();

      execSync("kubectl get pods -n pepr-demo", { stdio: "inherit" });
      execSync("kubectl top po -n pepr-system", { stdio: "inherit" });
      execSync("kubectl get po -n pepr-system", { stdio: "inherit" });

      for (const [pod, count] of podMap) {
        checkPod(pod, count, i);
      }
    }

    await sleep(300_000);
  }

  console.log("Soak test passed successfully!");
}

void main();
