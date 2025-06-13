// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it, vi } from "vitest";
import { generateAllYaml } from "./generateAllYaml";
import { Assets } from "../assets";
import { ModuleConfig } from "../../types";
import { V1Deployment, KubernetesObject } from "@kubernetes/client-node";
import { promises as fs } from "fs";
import { webhookConfigGenerator } from "../webhooks";
import { WebhookType } from "../../enums";
import { getNamespace, getModuleSecret } from "../pods";
import { apiPathSecret, service, tlsSecret, watcherService } from "../networking";
import {
  clusterRole,
  clusterRoleBinding,
  serviceAccount,
  storeRole,
  storeRoleBinding,
} from "../rbac";
import crypto from "crypto";

vi.mock("../webhooks", () => ({
  webhookConfigGenerator: vi.fn(async (assets: Assets, type: string, timeout: number) => ({
    kind: "WebhookConfig",
    metadata: { name: `${assets.name}-webhook-${type.toLowerCase()}` },
    webhooks: [
      {
        timeoutSeconds: timeout,
      },
    ],
  })),
}));
vi.mock("fs",async () => {
  const actualFs = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actualFs,
    promises: {
      readFile: vi.fn<() => Promise<string>>().mockResolvedValue("mocked"),
      writeFile: vi.fn(),
      access: vi.fn(),
    },
  };
});

vi.mock("crypto", async () => {
  
  const actualCrypto = await vi.importActual<typeof import("crypto")>("crypto");
  return {
    ...actualCrypto,
    createHash: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue("mocked-hash"),
    })),
  }
});

vi.mock("@kubernetes/client-node", async () => {
  const actualClientNode = await vi.importActual<typeof import("@kubernetes/client-node")>("@kubernetes/client-node");
  return {
    ...actualClientNode,
    dumpYaml: vi.fn(
    (resource: KubernetesObject) => `mocked-yaml-for-${resource?.metadata?.name || "unknown"}`,
  )}

});

vi.mock("../pods", () => ({
  getNamespace: vi.fn().mockReturnValue({}),
  getModuleSecret: vi.fn().mockReturnValue({}),
}));

vi.mock("../rbac", () => ({
  clusterRole: vi.fn().mockReturnValue({}),
  clusterRoleBinding: vi.fn().mockReturnValue({}),
  serviceAccount: vi.fn().mockReturnValue({}),
  storeRole: vi.fn().mockReturnValue({}),
  storeRoleBinding: vi.fn().mockReturnValue({}),
}));

vi.mock("../networking", () => ({
  apiPathSecret: vi.fn().mockReturnValue({}),
  service: vi.fn().mockReturnValue({}),
  tlsSecret: vi.fn().mockReturnValue({}),
  watcherService: vi.fn().mockReturnValue({}),
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
    const mockReadFile = vi.mocked(fs.readFile);
    const cryptoCreateHashSpy = vi.spyOn(crypto,"createHash");
    
    await generateAllYaml(assets, mockDeployments);
    expect(mockReadFile).toHaveBeenCalledTimes(1);
    expect(cryptoCreateHashSpy).toHaveBeenCalledTimes(1);
    expect(cryptoCreateHashSpy).toHaveBeenCalledWith("sha256");
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
    expect(getModuleSecret).toHaveBeenCalledWith(assets.name, "mocked", "3d4a07bcbf2eaec380ad707451832924bee1197fbdf43d20d6d4bc96c8284268");
    expect(storeRole).toHaveBeenCalledWith(assets.name);
    expect(storeRoleBinding).toHaveBeenCalledWith(assets.name);
  });
});
