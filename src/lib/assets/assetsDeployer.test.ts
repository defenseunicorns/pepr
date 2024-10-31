// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { AssetsConfig } from "./assetsConfig";
import { AssetsDeployer } from "./assetsDeployer";
import { deploy } from "./deploy";
import { loadCapabilities } from "./loader";
import { allYaml, overridesFile, zarfYaml } from "./yaml";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { CapabilityExport } from "../types";
import * as fs from "fs";
import { createDirectoryIfNotExists, dedent } from "../helpers";
import { dumpYaml } from "@kubernetes/client-node";
import { webhookConfig } from "./webhooks";
import { admissionDeployTemplate, serviceMonitorTemplate } from "./helm";

jest.mock("./deploy");
jest.mock("./loader");
jest.mock("./yaml");
jest.mock("../helpers");
jest.mock("fs", () => {
  const actualFs = jest.requireActual("fs") as typeof fs;
  return {
    ...actualFs,
    promises: {
      ...actualFs.promises,
      readFile: jest.fn(),
      writeFile: jest.fn(),
    },
  };
});
jest.mock("@kubernetes/client-node", () => {
  const actualClientNode = jest.requireActual("@kubernetes/client-node");
  return {
    ...(actualClientNode as object),
    dumpYaml: jest.fn(),
  };
});
jest.mock("./webhooks", () => ({
  webhookConfig: jest.fn(),
}));

const mockCapabilities: CapabilityExport[] = [
  {
    name: "test-capability",
    namespaces: ["test-namespace"],
    bindings: [],
    hasSchedule: false,
    description: "",
  },
];

describe("AssetsDeployer", () => {
  const mockAssetsConfig = new AssetsConfig(
    { uuid: "test-uuid", alwaysIgnore: {}, peprVersion: "1.0.0" },
    "/path/to/module",
  );

  let assetsDeployer: AssetsDeployer;

  beforeEach(() => {
    jest.clearAllMocks();
    assetsDeployer = new AssetsDeployer(mockAssetsConfig);
    (loadCapabilities as jest.MockedFunction<typeof loadCapabilities>).mockResolvedValue(mockCapabilities);

    jest.spyOn(process, "exit").mockImplementation(code => {
      throw new Error(`process.exit called with code ${code}`);
    });
  });

  describe("deploy", () => {
    it("should load capabilities and trigger deploy logic", async () => {
      await assetsDeployer.deploy(true, 30);
      expect(loadCapabilities).toHaveBeenCalledWith(mockAssetsConfig.path);
      expect(deploy).toHaveBeenCalledWith(mockAssetsConfig, true, 30);
      expect(mockAssetsConfig.capabilities).toBe(mockCapabilities);
    });
  });

  describe("allYaml", () => {
    it("should call allYaml with correct arguments", async () => {
      (allYaml as jest.MockedFunction<typeof allYaml>).mockResolvedValue("mockYaml");
      const result = await assetsDeployer.allYaml("image-pull-secret");
      expect(allYaml).toHaveBeenCalledWith(mockAssetsConfig, "image-pull-secret");
      expect(result).toBe("mockYaml");
    });
  });

  describe("zarfYaml", () => {
    it("should call zarfYaml with correct path", async () => {
      (zarfYaml as jest.MockedFunction<typeof zarfYaml>).mockResolvedValue("mockZarfYaml" as never);
      const result = await assetsDeployer.zarfYaml("/mock/path");
      expect(zarfYaml).toHaveBeenCalledWith(mockAssetsConfig, "/mock/path");
      expect(result).toBe("mockZarfYaml");
    });
  });

  describe("generateHelmChart", () => {
    const mockBasePath = "/mock/base/path";
    const mockYaml = "mockYaml";
    const mockUuid = "test-uuid";
    const mockTimestamp = 1234567890;

    beforeEach(() => {
      mockAssetsConfig.config.uuid = mockUuid;
      mockAssetsConfig.buildTimestamp = mockTimestamp.toString();
      (fs.promises.readFile as jest.MockedFunction<typeof fs.promises.readFile>).mockResolvedValue("mockCode");
      (fs.promises.writeFile as jest.MockedFunction<typeof fs.promises.writeFile>).mockResolvedValue(undefined);
      (createDirectoryIfNotExists as jest.MockedFunction<typeof createDirectoryIfNotExists>).mockResolvedValue();
      (overridesFile as jest.MockedFunction<typeof overridesFile>).mockResolvedValue();
      (dumpYaml as jest.Mock).mockReturnValue(mockYaml);
    });

    it("should create the required directories and files", async () => {
      await assetsDeployer.generateHelmChart(mockBasePath);
      expect(createDirectoryIfNotExists).toHaveBeenCalledWith(`${mockBasePath}/${mockUuid}-chart`);
      expect(overridesFile).toHaveBeenCalledWith(mockAssetsConfig, `${mockBasePath}/${mockUuid}-chart/values.yaml`);
      expect(dumpYaml).toHaveBeenCalledTimes(9);
    });

    it("should write specific files when webhooks are defined", async () => {
      (webhookConfig as jest.MockedFunction<typeof webhookConfig>)
        .mockResolvedValueOnce({}) // validateWebhook
        .mockResolvedValueOnce(null); // mutateWebhook

      await assetsDeployer.generateHelmChart(mockBasePath);
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        `${mockBasePath}/${mockUuid}-chart/templates/admission-deployment.yaml`,
        dedent(admissionDeployTemplate(mockAssetsConfig.buildTimestamp)),
      );
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        `${mockBasePath}/${mockUuid}-chart/templates/admission-service-monitor.yaml`,
        dedent(serviceMonitorTemplate("admission")),
      );
    });

    it("should skip specific files when webhooks are not defined", async () => {
      (webhookConfig as jest.MockedFunction<typeof webhookConfig>)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await assetsDeployer.generateHelmChart(mockBasePath);
      expect(fs.promises.writeFile).not.toHaveBeenCalledWith(
        `${mockBasePath}/${mockUuid}-chart/templates/admission-deployment.yaml`,
      );
    });
  });
});
