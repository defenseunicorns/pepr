// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { KubernetesListObject } from "@kubernetes/client-node";
import { K8s, kind } from "kubernetes-fluent-client";
import { Command } from "commander";

export default function (program: Command): void {
  program
    .command("uuid [uuid]")
    .description("Module UUID(s) currently deployed in the cluster")
    .action(async uuid => {
      const deployments = await getPeprDeploymentsByUUID(uuid);
      const uuidTable = buildUUIDTable(deployments);

      console.log("UUID\t\tDescription");
      console.log("--------------------------------------------");

      Object.entries(uuidTable).forEach(([uuid, description]) => {
        console.log(`${uuid}\t${description}`);
      });
    });
}

export async function getPeprDeploymentsByUUID(
  uuid?: string,
): Promise<KubernetesListObject<kind.Deployment>> {
  const k8sQuery = K8s(kind.Deployment).InNamespace("pepr-system");

  let deployments = uuid
    ? await k8sQuery.WithLabel("pepr.dev/uuid", uuid).Get()
    : await k8sQuery.WithLabel("pepr.dev/uuid").Get();

  if (uuid) {
    deployments = {
      ...deployments,
      items: deployments.items.filter(
        deploy => deploy.metadata?.labels?.["pepr.dev/uuid"] === uuid,
      ),
    };
  }

  return deployments;
}

export function buildUUIDTable(
  deployments: KubernetesListObject<kind.Deployment>,
): Record<string, string> {
  const uuidTable: Record<string, string> = {};

  deployments.items.forEach(deploy => {
    const uuid = deploy.metadata?.labels?.["pepr.dev/uuid"] || "";
    const description = deploy.metadata?.annotations?.["pepr.dev/description"] || "";

    if (uuid !== "") {
      uuidTable[uuid] = description;
    }
  });

  return uuidTable;
}
