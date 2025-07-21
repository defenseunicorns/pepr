// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { KubernetesListObject } from "@kubernetes/client-node";
import { K8s, kind } from "kubernetes-fluent-client";
import { Command } from "commander";
import Log from "../lib/telemetry/logger";

export default function (program: Command): void {
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

      // Populate the uuidTable with the UUID and description
      deployments.items.map(deploy => {
        const uuid = deploy.metadata?.labels?.["pepr.dev/uuid"] || "";
        const description = deploy.metadata?.annotations?.["pepr.dev/description"] || "";
        if (uuid !== "") {
          uuidTable[uuid] = description;
        }
      });

      // Find the longest UUID to determine padding
      const longestUUID = Math.max(4, ...Object.keys(uuidTable).map(uuid => uuid.length));

      // Header
      Log.info(`${"UUID".padEnd(longestUUID + 4)}Description`);
      Log.info(`${"-".repeat(longestUUID + 4)}${"-".repeat(30)}`);

      // Data rows
      Object.entries(uuidTable).forEach(([uuid, description]) => {
        Log.info(`${uuid.padEnd(longestUUID + 4)}${description}`);
      });
    });
}
