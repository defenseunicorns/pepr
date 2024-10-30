// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import crypto from "crypto";
import { genTLS, TLSOut } from "../tls";
import { ModuleConfig } from "../module";
import { CapabilityExport } from "../types";
import { WebhookIgnore } from "../k8s";
import { AssetsConfig } from "./assetsConfig";
import { jest, describe, beforeEach, it, expect } from "@jest/globals";

jest.mock("crypto");
jest.mock("../tls");

describe("AssetsConfig", () => {
  const mockUUID = "test-uuid";
  const mockAlwaysIgnore: WebhookIgnore = {}; // Adjust as per actual type
  const mockPeprVersion = "1.0.0";
  const mockConfig: ModuleConfig = {
    uuid: mockUUID,
    alwaysIgnore: mockAlwaysIgnore,
    peprVersion: mockPeprVersion,
  };

  const mockPath = "/path/to/module";
  const mockHost = "example.com";
  const mockTLS: TLSOut = {
    crt: "mockCert",
    key: "mockKey",
    ca: "",
    pem: {
      ca: "",
      crt: "",
      key: "",
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();
    (genTLS as jest.Mock).mockReturnValue(mockTLS);
    (crypto.randomBytes as jest.Mock).mockReturnValue({
      toString: () => "mockApiToken",
    });
  });

  it("should initialize with correct values", () => {
    const assetsConfig = new AssetsConfig(mockConfig, mockPath, mockHost);

    expect(assetsConfig.name).toBe(`pepr-${mockUUID}`);
    expect(assetsConfig.buildTimestamp).toMatch(/^\d+$/);
    expect(assetsConfig.alwaysIgnore).toBe(mockAlwaysIgnore);
    expect(assetsConfig.image).toBe(`ghcr.io/defenseunicorns/pepr/controller:v${mockPeprVersion}`);
    expect(assetsConfig.tls).toEqual(mockTLS);
    expect(assetsConfig.apiToken).toBe("mockApiToken");
  });

  it("should set hash correctly", () => {
    const assetsConfig = new AssetsConfig(mockConfig, mockPath);
    const testHash = "test-hash";

    assetsConfig.setHash(testHash);

    expect(assetsConfig.hash).toBe(testHash);
  });

  it("should handle undefined host", () => {
    const assetsConfig = new AssetsConfig(mockConfig, mockPath);

    expect(assetsConfig.tls).toEqual(mockTLS);
    expect(genTLS).toHaveBeenCalledWith("pepr-test-uuid.pepr-system.svc");
  });

  it("should have capabilities as undefined initially", () => {
    const assetsConfig = new AssetsConfig(mockConfig, mockPath);

    expect(assetsConfig.capabilities).toBeUndefined();
  });

  it("should allow setting capabilities", () => {
    const assetsConfig = new AssetsConfig(mockConfig, mockPath);
    const mockCapabilities: CapabilityExport[] = [
      {
        name: "test",
        description: "test",
        namespaces: [],
        bindings: [],
        hasSchedule: false,
      },
    ];

    assetsConfig.capabilities = mockCapabilities;

    expect(assetsConfig.capabilities).toBe(mockCapabilities);
  });
});
