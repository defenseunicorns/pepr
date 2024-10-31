// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { AssetsConfig } from "./assetsConfig";
import { AssetsDeployer } from "./assetsDeployer";
import { deploy } from "./deploy";
import { loadCapabilities } from "./loader";
import { allYaml, overridesFile, zarfYaml, zarfYamlChart } from "./yaml";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { CapabilityExport } from "../types";
import * as fs from "fs";
import { createDirectoryIfNotExists, dedent } from "../helpers";
import { dumpYaml } from "@kubernetes/client-node";
import { webhookConfig } from "./webhooks";
import { admissionDeployTemplate, clusterRoleTemplate, nsTemplate, serviceMonitorTemplate } from "./helm";
import { chartYaml } from "./helm";

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

    jest.spyOn(process, "exit").mockImplementation((code?: string | number | null) => {
      throw new Error(`process.exit called with code ${code}`);
    });
  });

  describe("deploy", () => {
    it("should load capabilities and trigger the deploy logic", async () => {
      await assetsDeployer.deploy(true, 30);

      expect(loadCapabilities).toHaveBeenCalledWith(mockAssetsConfig.path);
      expect(deploy).toHaveBeenCalledWith(mockAssetsConfig, true, 30);
      expect(mockAssetsConfig.capabilities).toBe(mockCapabilities);
    });
  });

  describe("allYaml", () => {
    it("should load capabilities and call allYaml", async () => {
      (allYaml as jest.MockedFunction<typeof allYaml>).mockResolvedValue("mockYaml");

      const result = await assetsDeployer.allYaml("image-pull-secret");

      expect(loadCapabilities).toHaveBeenCalledWith(mockAssetsConfig.path);
      expect(allYaml).toHaveBeenCalledWith(mockAssetsConfig, "image-pull-secret");
      expect(result).toBe("mockYaml");
    });
  });

  describe("zarfYaml", () => {
    it("should call zarfYaml with the correct arguments", async () => {
      const mockZarfYaml = "mockZarfYaml";
      (zarfYaml as jest.MockedFunction<typeof zarfYaml>).mockResolvedValue(mockZarfYaml as unknown as never);

      const result = await assetsDeployer.zarfYaml("/mock/path");

      expect(zarfYaml).toHaveBeenCalledWith(mockAssetsConfig, "/mock/path");
      expect(result).toBe("mockZarfYaml");
    });
  });

  describe("zarfYamlChart", () => {
    it("should call zarfYamlChart with the correct arguments", async () => {
      const mockZarfYamlChart = "mockZarfYamlChart";
      (zarfYamlChart as jest.MockedFunction<typeof zarfYamlChart>).mockResolvedValue(
        mockZarfYamlChart as unknown as never,
      );

      const result = await assetsDeployer.zarfYamlChart("/mock/path");

      expect(zarfYamlChart).toHaveBeenCalledWith(mockAssetsConfig, "/mock/path");
      expect(result).toBe("mockZarfYamlChart");
    });
  });

  describe("generateHelmChart", () => {
    const mockBasePath = "/mock/base/path";
    const mockUuid = "test-uuid";
    const mockDescription = "test-description";
    const mockYaml = "mockYaml";
    const mockCode = "mockCode";
    const mockTimestamp = 1234567890;

    beforeEach(() => {
      // Setting up common configuration for all tests
      mockAssetsConfig.config.uuid = mockUuid;
      mockAssetsConfig.config.description = mockDescription;
      Object.defineProperty(mockAssetsConfig, "path", { value: "/mock/path" });
      Object.defineProperty(mockAssetsConfig, "name", { value: "test-name" });
      Object.defineProperty(mockAssetsConfig, "tls", { value: "test-tls" });
      Object.defineProperty(mockAssetsConfig, "apiToken", { value: "test-api-token" });
      mockAssetsConfig.hash = "test-hash";
      mockAssetsConfig.buildTimestamp = mockTimestamp.toString();

      (fs.promises.readFile as jest.MockedFunction<typeof fs.promises.readFile>).mockResolvedValue(
        mockCode as unknown as never,
      );
      (fs.promises.writeFile as jest.MockedFunction<typeof fs.promises.writeFile>).mockResolvedValue(
        undefined as never,
      );
      (createDirectoryIfNotExists as jest.MockedFunction<typeof createDirectoryIfNotExists>).mockResolvedValue();
      (overridesFile as jest.MockedFunction<typeof overridesFile>).mockResolvedValue();
      (dumpYaml as jest.Mock).mockReturnValue(mockYaml);
    });

    it("should generate the helm chart with the correct structure", async () => {
      (webhookConfig as jest.MockedFunction<typeof webhookConfig>).mockResolvedValue(null);

      try {
        await assetsDeployer.generateHelmChart(mockBasePath);
      } catch (error) {
        expect(error).toEqual(new Error("process.exit called with code 1"));
      }

      // Verify directory creation calls
      expect(createDirectoryIfNotExists).toHaveBeenCalledWith(`${mockBasePath}/${mockUuid}-chart`);
      expect(createDirectoryIfNotExists).toHaveBeenCalledWith(`${mockBasePath}/${mockUuid}-chart/charts`);
      expect(createDirectoryIfNotExists).toHaveBeenCalledWith(`${mockBasePath}/${mockUuid}-chart/templates`);

      // Verify values.yaml generation
      expect(overridesFile).toHaveBeenCalledWith(mockAssetsConfig, `${mockBasePath}/${mockUuid}-chart/values.yaml`);

      expect(fs.promises.readFile).toHaveBeenCalledWith("/mock/path");
      expect(overridesFile).toHaveBeenCalledWith(mockAssetsConfig, `${mockBasePath}/${mockUuid}-chart/values.yaml`);
      expect(dumpYaml).toHaveBeenCalledTimes(9);
      expect(webhookConfig).toHaveBeenCalledTimes(2); // `mutate` and `validate` webhook configurations

      // Verify the expected writeFile calls
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        `${mockBasePath}/${mockUuid}-chart/Chart.yaml`,
        dedent(chartYaml(mockUuid, mockDescription)),
      );
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        `${mockBasePath}/${mockUuid}-chart/templates/namespace.yaml`,
        dedent(nsTemplate()),
      );
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        `${mockBasePath}/${mockUuid}-chart/templates/watcher-service.yaml`,
        mockYaml,
      );
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        `${mockBasePath}/${mockUuid}-chart/templates/admission-service.yaml`,
        mockYaml,
      );
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        `${mockBasePath}/${mockUuid}-chart/templates/tls-secret.yaml`,
        mockYaml,
      );
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        `${mockBasePath}/${mockUuid}-chart/templates/api-token-secret.yaml`,
        mockYaml,
      );
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        `${mockBasePath}/${mockUuid}-chart/templates/module-secret.yaml`,
        mockYaml,
      );
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        `${mockBasePath}/${mockUuid}-chart/templates/store-role.yaml`,
        mockYaml,
      );
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        `${mockBasePath}/${mockUuid}-chart/templates/store-role-binding.yaml`,
        mockYaml,
      );
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        `${mockBasePath}/${mockUuid}-chart/templates/cluster-role.yaml`,
        dedent(clusterRoleTemplate()),
      );
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        `${mockBasePath}/${mockUuid}-chart/templates/cluster-role-binding.yaml`,
        mockYaml,
      );
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        `${mockBasePath}/${mockUuid}-chart/templates/service-account.yaml`,
        mockYaml,
      );
    });

    it("should handle errors during helm chart generation", async () => {
      const mockBasePath = "/mock/base/path";
      const mockError = new Error("process.exit called with code 1");

      (createDirectoryIfNotExists as jest.MockedFunction<typeof createDirectoryIfNotExists>).mockRejectedValue(
        mockError,
      );

      await expect(assetsDeployer.generateHelmChart(mockBasePath)).rejects.toThrow("process.exit called with code 1");
    });

    it("should write admission deploy and service monitor files when either validateWebhook or mutateWebhook is defined", async () => {
      // Set up mock to return a non-null value for validateWebhook
      (webhookConfig as jest.MockedFunction<typeof webhookConfig>)
        .mockResolvedValueOnce({}) // validateWebhook
        .mockResolvedValueOnce(null); // mutateWebhook

      await assetsDeployer.generateHelmChart(mockBasePath);

      // Verify fs.writeFile is called with admission deploy and service monitor paths
      const admissionDeployPath = `${mockBasePath}/${mockUuid}-chart/templates/admission-deployment.yaml`;
      const admissionServiceMonitorPath = `${mockBasePath}/${mockUuid}-chart/templates/admission-service-monitor.yaml`;

      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        admissionDeployPath,
        dedent(admissionDeployTemplate(mockAssetsConfig.buildTimestamp)),
      );
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        admissionServiceMonitorPath,
        dedent(serviceMonitorTemplate("admission")),
      );
    });

    it("should not write admission deploy and service monitor files when both validateWebhook and mutateWebhook are null", async () => {
      // Set up mock to return null for both validateWebhook and mutateWebhook
      (webhookConfig as jest.MockedFunction<typeof webhookConfig>)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await assetsDeployer.generateHelmChart(mockBasePath);

      // Verify fs.writeFile is not called with admission deploy and service monitor paths
      const admissionDeployPath = `${mockBasePath}/${mockUuid}-chart/templates/admission-deployment.yaml`;
      const admissionServiceMonitorPath = `${mockBasePath}/${mockUuid}-chart/templates/admission-service-monitor.yaml`;

      expect(fs.promises.writeFile).not.toHaveBeenCalledWith(
        admissionDeployPath,
        dedent(admissionDeployTemplate(mockAssetsConfig.buildTimestamp)),
      );
      expect(fs.promises.writeFile).not.toHaveBeenCalledWith(
        admissionServiceMonitorPath,
        dedent(serviceMonitorTemplate("admission")),
      );
    });
  });
});
