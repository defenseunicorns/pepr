// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { KubernetesListObject } from "@kubernetes/client-node";
import { K8s, kind } from "kubernetes-fluent-client";
import { RootCmd } from "./root";

export default function (program: RootCmd) {
  program
    .command("uuid [uuid]")
    .description("Module UUID(s) currently deployed in the cluster")
    .action(async uuid => {
      const uuidTable: Record<string, string> = {};
      let deployments: KubernetesListObject<kind.Deployment>;

      if (!uuid) {
        deployments = await K8s(kind.Deployment)
          .InNamespace("pepr-system")
          .WithLabel("pepr.dev/uuid")
          .Get();
      } else {
        deployments = await K8s(kind.Deployment)
          .InNamespace("pepr-system")
          .WithLabel("pepr.dev/uuid", uuid)
          .Get();
      }

      // Get the logs for the `app=pepr-${module}` or `pepr.dev/controller=admission` pod selector
      deployments.items.map(deploy => {
        const uuid = deploy.metadata?.labels?.["pepr.dev/uuid"] || "";
        const description = deploy.metadata?.annotations?.["pepr.dev/description"] || "";
        if (uuid !== "") {
          uuidTable[uuid] = description;
        }
      });

      console.log("UUID\t\tDescription");
      console.log("--------------------------------------------");

      Object.entries(uuidTable).forEach(([uuid, description]) => {
        console.log(`${uuid}\t${description}`);
      });
    });
}
