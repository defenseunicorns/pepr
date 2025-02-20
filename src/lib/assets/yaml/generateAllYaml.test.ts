// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it, jest } from "@jest/globals";
import { generateAllYaml } from "./generateAllYaml";
import { Assets } from "../assets";
import { ModuleConfig } from "../../types";
import { V1Deployment, KubernetesObject } from "@kubernetes/client-node";
import { promises as fs } from "fs";
import { webhookConfigGenerator } from "../webhooks";
import { WebhookType } from "../../enums";
import { getModuleSecret, getNamespace } from "../pods";
import { apiPathSecret, service, tlsSecret, watcherService } from "../networking";
import { clusterRole, clusterRoleBinding, serviceAccount, storeRole, storeRoleBinding } from "../rbac";
import crypto from "crypto";

jest.mock("../webhooks", () => ({
  webhookConfigGenerator: jest.fn(async (assets: Assets, type: string, timeout: number) => ({
    kind: "WebhookConfig",
    metadata: { name: `${assets.name}-webhook-${type.toLowerCase()}` },
    webhooks: [
      {
        timeoutSeconds: timeout,
      },
    ],
  })),
}));
jest.mock("fs", () => ({
  ...(jest.requireActual("fs") as object),
  promises: {
    readFile: jest.fn<() => Promise<string>>().mockResolvedValue("mocked"),
    writeFile: jest.fn(),
    access: jest.fn(),
  },
}));
jest.mock("crypto", () => ({
  ...(jest.requireActual("crypto") as object),
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue("mocked-hash"),
  })),
}));

jest.mock("@kubernetes/client-node", () => ({
  ...(jest.requireActual("@kubernetes/client-node") as object),
  dumpYaml: jest.fn((resource: KubernetesObject) => `mocked-yaml-for-${resource?.metadata?.name || "unknown"}`),
}));

jest.mock("../pods", () => ({
  getNamespace: jest.fn().mockReturnValue({}),
  getModuleSecret: jest.fn().mockReturnValue({}),
}));

jest.mock("../rbac", () => ({
  clusterRole: jest.fn().mockReturnValue({}),
  clusterRoleBinding: jest.fn().mockReturnValue({}),
  serviceAccount: jest.fn().mockReturnValue({}),
  storeRole: jest.fn().mockReturnValue({}),
  storeRoleBinding: jest.fn().mockReturnValue({}),
}));

jest.mock("../networking", () => ({
  apiPathSecret: jest.fn().mockReturnValue({}),
  service: jest.fn().mockReturnValue({}),
  tlsSecret: jest.fn().mockReturnValue({}),
  watcherService: jest.fn().mockReturnValue({}),
}));
describe("generateAllYaml", () => {
  const moduleConfig: ModuleConfig = {
    uuid: "test-uuid",
    alwaysIgnore: {
      namespaces: ["zarf"],
    },
    peprVersion: "0.0.1",
    appVersion: "0.0.1",
    description: "A test module",
    webhookTimeout: 10,
    onError: "reject",
    logLevel: "info",
    env: {},
    rbac: [],
    rbacMode: "scoped",
    customLabels: {},
  };
  const assets = new Assets(moduleConfig, "/tmp", ["secret1", "secret2"], "localhost");
  assets.capabilities = [];
  const mockDeployments: { default: V1Deployment; watch: V1Deployment | null } = {
    default: { kind: "Deployment", metadata: { name: "default-deployment" } } as V1Deployment,
    watch: { kind: "Deployment", metadata: { name: "watch-deployment" } } as V1Deployment,
  };

  it("should read the minified module file and create a hash", async () => {
    const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
    await generateAllYaml(assets, mockDeployments);
    expect(mockReadFile).toHaveBeenCalledTimes(1);
    expect(crypto.createHash).toHaveBeenCalledWith("sha256");
  });

  it("should call webhookConfigGenerator for mutate and validate", async () => {
    await generateAllYaml(assets, mockDeployments);
    expect(webhookConfigGenerator).toHaveBeenCalledWith(assets, WebhookType.MUTATE, 10);
    expect(webhookConfigGenerator).toHaveBeenCalledWith(assets, WebhookType.VALIDATE, 10);
  });

  it("should call functions to generate kubernetes manifests required to deploy Pepr", async () => {
    await generateAllYaml(assets, mockDeployments);

    expect(getNamespace).toHaveBeenCalledWith(assets.config.customLabels?.namespace);
    expect(clusterRole).toHaveBeenCalledWith(
      assets.name,
      assets.capabilities,
      moduleConfig.rbacMode,
      moduleConfig.rbac,
    );
    expect(clusterRoleBinding).toHaveBeenCalledWith(assets.name);
    expect(serviceAccount).toHaveBeenCalledWith(assets.name);
    expect(apiPathSecret).toHaveBeenCalledWith(assets.name, assets.apiPath);
    expect(tlsSecret).toHaveBeenCalledWith(assets.name, assets.tls);
    expect(service).toHaveBeenCalledWith(assets.name);
    expect(watcherService).toHaveBeenCalledWith(assets.name);
    expect(getModuleSecret).toHaveBeenCalledWith(assets.name, "mocked", "mocked-hash");
    expect(storeRole).toHaveBeenCalledWith(assets.name);
    expect(storeRoleBinding).toHaveBeenCalledWith(assets.name);
  });
});
