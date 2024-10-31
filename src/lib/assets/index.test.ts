// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { AssetsConfig } from "./assetsConfig";
import { AssetsDeployer } from "./assetsDeployer";
import { ModuleConfig } from "../module";
import { createAssets } from "./index";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

// Mock dependencies
jest.mock("./assetsConfig");
jest.mock("./assetsDeployer");

describe("createAssets", () => {
  const mockConfig = {
    // Populate with necessary mock properties
  } as ModuleConfig;
  const mockPath = "test/path";
  const mockHost = "localhost";

  beforeEach(() => {
    (AssetsConfig as jest.Mock).mockClear();
    (AssetsDeployer as jest.Mock).mockClear();
  });

  it("should create an AssetsConfig instance with given config, path, and host", () => {
    createAssets(mockConfig, mockPath, mockHost);
    expect(AssetsConfig).toHaveBeenCalledWith(mockConfig, mockPath, mockHost);
  });

  it("should create an AssetsConfig instance with default host if none is provided", () => {
    createAssets(mockConfig, mockPath);
    expect(AssetsConfig).toHaveBeenCalledWith(mockConfig, mockPath, undefined);
  });

  it("should create and return an AssetsDeployer instance with the created AssetsConfig", () => {
    const mockAssetsConfigInstance = new AssetsConfig(mockConfig, mockPath, mockHost);
    (AssetsConfig as jest.Mock).mockReturnValue(mockAssetsConfigInstance);

    const result = createAssets(mockConfig, mockPath, mockHost);
    expect(AssetsDeployer).toHaveBeenCalledWith(mockAssetsConfigInstance);
    expect(result).toBeInstanceOf(AssetsDeployer);
  });
});
