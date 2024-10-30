/* eslint-disable max-statements */
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
import { clusterRoleTemplate, nsTemplate } from "./helm";
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

describe("AssetsDeployer", () => {
  const mockAssetsConfig = new AssetsConfig(
    { uuid: "test-uuid", alwaysIgnore: {}, peprVersion: "1.0.0" },
    "/path/to/module",
  );

  let assetsDeployer: AssetsDeployer;
  let mockCapabilities: CapabilityExport[];

  beforeEach(() => {
    jest.clearAllMocks();
    assetsDeployer = new AssetsDeployer(mockAssetsConfig);
    mockCapabilities = [
      {
        name: "test",
        description: "test",
        namespaces: [],
        bindings: [],
        hasSchedule: false,
      },
    ] as CapabilityExport[];

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

    describe("generateHelmChart", () => {
      it("should generate the helm chart with the correct structure", async () => {
        const mockBasePath = "/mock/base/path";
        const mockUuid = "test-uuid";
        const mockDescription = "test-description";
        const mockYaml = "mockYaml";
        const mockCode = "mockCode";
        const mockTimestamp = 1234567890;

        mockAssetsConfig.config.uuid = mockUuid;
        mockAssetsConfig.config.description = mockDescription;
        Object.defineProperty(mockAssetsConfig, "path", { value: "/mock/path" });
        Object.defineProperty(mockAssetsConfig, "name", { value: "test-name" });
        Object.defineProperty(mockAssetsConfig, "tls", { value: "test-tls" });
        Object.defineProperty(mockAssetsConfig, "apiToken", { value: "test-api-token" });
        mockAssetsConfig.hash = "test-hash";
        mockAssetsConfig.buildTimestamp = mockTimestamp.toString();

        // Ensure all mocks are set up to resolve correctly
        (fs.promises.readFile as jest.MockedFunction<typeof fs.promises.readFile>).mockResolvedValue(
          mockCode as unknown as never,
        );
        (fs.promises.writeFile as jest.MockedFunction<typeof fs.promises.writeFile>).mockResolvedValue(
          undefined as never,
        );

        (createDirectoryIfNotExists as jest.MockedFunction<typeof createDirectoryIfNotExists>).mockResolvedValue();
        (overridesFile as jest.MockedFunction<typeof overridesFile>).mockResolvedValue();
        (dumpYaml as jest.Mock).mockReturnValue(mockYaml);
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
    });
  });
});
