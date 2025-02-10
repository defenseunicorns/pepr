// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Log as K8sLog, KubeConfig, KubernetesListObject } from "@kubernetes/client-node";
import { K8s, kind } from "kubernetes-fluent-client";
import stream from "stream";
import { ResponseItem } from "../lib/types";
import { RootCmd } from "./root";

interface LogPayload {
  namespace: string;
  name: string;
  res: {
    uid: string;
    allowed?: boolean;
    patch?: string;
    patchType?: string;
    warnings?: string;
    status?: {
      message: string;
    };
  };
}

export default function (program: RootCmd): void {
  program
    .command("monitor [module-uuid]")
    .description("Monitor a Pepr Module")
    .action(async uuid => {
      const { labels, errorMessage } = getLabelsAndErrorMessage(uuid);

      // Get the logs for the `app=pepr-${module}` or `pepr.dev/controller=admission` pod selector
      const pods: KubernetesListObject<kind.Pod> = await K8s(kind.Pod)
        .InNamespace("pepr-system")
        .WithLabel(labels[0], labels[1])
        .Get();

      // Pods will ways have a metadata and name fields
      const podNames: string[] = pods.items.flatMap(pod => pod.metadata!.name || "");

      if (podNames.length < 1) {
        console.error(errorMessage);
        return;
      }

      const log = getK8sLogFromKubeConfig();

      const logStream = createLogStream();

      for (const podName of podNames) {
        await log.log("pepr-system", podName, "server", logStream, {
          follow: true,
          pretty: false,
          timestamps: false,
        });
      }
    });
}

export function getLabelsAndErrorMessage(uuid?: string): {
  labels: string[];
  errorMessage: string;
} {
  let labels: string[];
  let errorMessage: string;

  if (!uuid) {
    labels = ["pepr.dev/controller", "admission"];
    errorMessage = `No pods found with admission labels`;
  } else {
    labels = ["app", `pepr-${uuid}`];
    errorMessage = `No pods found for module ${uuid}`;
  }

  return { labels, errorMessage };
}

export function getK8sLogFromKubeConfig(): K8sLog {
  const kc = new KubeConfig();
  kc.loadFromDefault();
  return new K8sLog(kc);
}

function createLogStream(): stream.PassThrough {
  const logStream = new stream.PassThrough();

  logStream.on("data", async chunk => {
    const lines = chunk.toString().split("\n");
    const respMsg = `"msg":"Check response"`;

    for (const line of lines) {
      if (!line.includes(respMsg)) continue;
      processLogLine(line);
    }
  });

  return logStream;
}

function processLogLine(line: string): void {
  try {
    const payload: LogPayload = JSON.parse(line.trim());
    const isMutate = payload.res.patchType || payload.res.warnings;
    const name = `${payload.namespace}${payload.name}`;
    const uid = payload.res.uid;

    if (isMutate) {
      processMutateLog(payload, name, uid);
    } else {
      processValidateLog(payload, name, uid);
    }
  } catch {
    // Do nothing
  }
}

export function processMutateLog(payload: LogPayload, name: string, uid: string): void {
  const plainPatch =
    payload.res.patch !== undefined && payload.res.patch !== null ? atob(payload.res.patch) : "";

  const patch = plainPatch !== "" && JSON.stringify(JSON.parse(plainPatch), null, 2);
  const patchType = payload.res.patchType || payload.res.warnings || "";
  const allowOrDeny = payload.res.allowed ? "🔀" : "🚫";

  console.log(`\n${allowOrDeny}  MUTATE     ${name} (${uid})`);
  if (patchType.length > 0) {
    console.log(`\n\u001b[1;34m${patch}\u001b[0m`);
  }
}

export function processValidateLog(payload: LogPayload, name: string, uid: string): void {
  const failures = Array.isArray(payload.res) ? payload.res : [payload.res];

  const filteredFailures = failures
    .filter((r: ResponseItem) => !r.allowed)
    .map((r: ResponseItem) => r.status?.message || "");

  console.log(`\n${filteredFailures.length > 0 ? "❌" : "✅"}  VALIDATE   ${name} (${uid})`);
  if (filteredFailures.length > 0) {
    console.log(`\u001b[1;31m${filteredFailures}\u001b[0m`);
  }
}
