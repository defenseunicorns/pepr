// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { ModuleConfig } from "../core/module";
import { Assets } from "./assets";
import { expect, describe, it, jest } from "@jest/globals";

jest.mock("fs", () => ({
  ...(jest.requireActual("fs") as object),
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    access: jest.fn(),
  },
}));

jest.mock("./loader", () => ({
  loadCapabilities: jest.fn(),
}));

describe("Assets", () => {
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

  it("should call deploy function with correct webhookTimeout", async () => {
    const deployFunction = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    await assets.deploy(deployFunction, true, assets.config.webhookTimeout);

    expect(deployFunction).toHaveBeenCalledWith(assets, true, assets.config.webhookTimeout);
    expect(deployFunction).toHaveBeenCalledTimes(1);
  });

  it("should call th zarfYamlgenerator with correct type", () => {
    const zarfYamlGenerator = jest.fn<() => string>().mockReturnValue("");
    assets.zarfYaml(zarfYamlGenerator, "/tmp");

    expect(zarfYamlGenerator).toHaveBeenCalledWith(assets, "/tmp", "manifests");
    expect(zarfYamlGenerator).toHaveBeenCalledTimes(1);
  });
});
