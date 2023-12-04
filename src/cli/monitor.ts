// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Log as K8sLog, KubeConfig } from "@kubernetes/client-node";
import { K8s, kind } from "kubernetes-fluent-client";
import stream from "stream";

import { RootCmd } from "./root";

export default function (program: RootCmd) {
  program
    .command("monitor <module-uuid>")
    .description("Monitor a Pepr Module")
    .action(async uuid => {
      if (!uuid) {
        console.error("Module UUID is required");
        process.exit(1);
      }

      // Get the logs for the `app=pepr-${module}` pod selector
      const pods = await K8s(kind.Pod)
        .InNamespace("pepr-system")
        .WithLabel("app", `pepr-${uuid}`)
        .Get();

      const podNames = pods.items.flatMap(pod => pod.metadata!.name) as string[];

      if (podNames.length < 1) {
        console.error(`No pods found for module ${uuid}`);
        process.exit(1);
      }

      const kc = new KubeConfig();
      kc.loadFromDefault();

      const log = new K8sLog(kc);

      const logStream = new stream.PassThrough();

      logStream.on("data", chunk => {
        const respMsg = `"msg":"Outgoing response"`;
        // Split the chunk into lines
        const lines = chunk.toString().split("\n");

        for (const line of lines) {
          // Check for `"msg":"Hello Pepr"`
          if (line.includes(respMsg)) {
            try {
              const payload = JSON.parse(line);
              const isMutate = payload.response.patchType;

              const name = `${payload.namespace}${payload.name}`;
              const uid = payload.uid;

              if (isMutate) {
                const allowOrDeny = payload.response.allowed ? "✅" : "❌";
                console.log(`\n${allowOrDeny}  MUTATE     ${name} (${uid})`);
              } else {
                const failures = payload.response
                  .filter(r => !r.allowed)
                  .map(r => r.status.message);
                // console.log(`${name} (${uid}) | VALIDATE | ${allow ? "ALLOW" : "DENY"}`);
                if (failures.length > 0) {
                  console.log(`\n❌  VALIDATE   ${name} (${uid})`);
                  console.debug(failures);
                } else {
                  console.log(`\n✅  VALIDATE   ${name} (${uid})`);
                }
              }
            } catch (e) {
              console.error(e);
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
