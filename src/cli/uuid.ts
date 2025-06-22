// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { KubernetesListObject } from "@kubernetes/client-node";
import { K8s, kind } from "kubernetes-fluent-client";
import { RootCmd } from "./root";

export default function (program: RootCmd): void {
  program
    .command("uuid [uuid]")
    .description("Module UUID(s) currently deployed in the cluster")
    .helpOption("-h, --help", "Display help for command")
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

      // Populate the uuidTable with the UUID and description
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
