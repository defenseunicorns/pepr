// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Log as K8sLog, KubeConfig } from "@kubernetes/client-node";
import { K8s, kind } from "kubernetes-fluent-client";
import stream from "stream";
import { ResponseItem } from "../lib/types";
import { RootCmd } from "./root";

export default function (program: RootCmd) {
  program
    .command("monitor [module-uuid]")
    .description("Monitor a Pepr Module")
    .action(async uuid => {
      let labels: string[];
      let errorMessage: string;

      if (!uuid) {
        labels = ["pepr.dev/controller", "admission"];
        errorMessage = `No pods found with admission labels`;
      } else {
        labels = ["app", `pepr-${uuid}`];
        errorMessage = `No pods found for module ${uuid}`;
      }

      // Get the logs for the `app=pepr-${module}` or `pepr.dev/controller=admission` pod selector
      const pods = await K8s(kind.Pod)
        .InNamespace("pepr-system")
        .WithLabel(labels[0], labels[1])
        .Get();

      const podNames = pods.items.flatMap(pod => pod.metadata!.name) as string[];

      if (podNames.length < 1) {
        console.error(errorMessage);
        process.exit(1);
      }

      const kc = new KubeConfig();
      kc.loadFromDefault();

      const log = new K8sLog(kc);

      const logStream = new stream.PassThrough();
      logStream.on("data", async chunk => {
        const respMsg = `"msg":"Check response"`;
        // Split the chunk into lines
        const lines = await chunk.toString().split("\n");

        for (const line of lines) {
          // Check for `"msg":"Hello Pepr"`
          if (line.includes(respMsg)) {
            try {
              const payload = JSON.parse(line.trim());
              const isMutate = payload.res.patchType || payload.res.warnings;

              const name = `${payload.namespace}${payload.name}`;
              const uid = payload.res.uid;

              if (isMutate) {
                const plainPatch =
                  payload.res?.patch !== undefined && payload.res?.patch !== null
                    ? atob(payload.res.patch)
                    : "";

                const patch = plainPatch !== "" && JSON.stringify(JSON.parse(plainPatch), null, 2);
                const patchType = payload.res.patchType || payload.res.warnings || "";
                const allowOrDeny = payload.res.allowed ? "🔀" : "🚫";
                console.log(`\n${allowOrDeny}  MUTATE     ${name} (${uid})`);
                if (patchType.length > 0) {
                  console.log(`\n\u001b[1;34m${patch}\u001b[0m`);
                }
              } else {
                const failures = Array.isArray(payload.res) ? payload.res : [payload.res];

                const filteredFailures = failures
                  .filter((r: ResponseItem) => !r.allowed)
                  .map((r: ResponseItem) => r.status.message);
                if (filteredFailures.length > 0) {
                  console.log(`\n❌  VALIDATE   ${name} (${uid})`);
                  console.log(`\u001b[1;31m${filteredFailures}\u001b[0m`);
                } else {
                  console.log(`\n✅  VALIDATE   ${name} (${uid})`);
                }
              }
            } catch {
              console.warn(`\nIGNORED - Unable to parse line: ${line}.`);
            }
          }
        }
      });

      for (const podName of podNames) {
        await log.log("pepr-system", podName, "server", logStream, {
          follow: true,
          pretty: false,
          timestamps: false,
        });
      }
    });
}
