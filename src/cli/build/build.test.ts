// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import {
  determineRbacMode,
  createOutputDirectory,
  handleValidCapabilityNames,
  handleCustomImageBuild,
  checkIronBankImage,
  validImagePullSecret,
  assignImage,
  fileExists,
} from "./build.helpers";
import { accessSync, constants } from "fs";
import { resolve } from "path";
import { createDirectoryIfNotExists } from "../../lib/filesystemService";
import { expect, describe, it, vi, beforeEach, type MockInstance } from "vitest";
import { createDockerfile } from "../../lib/included-files";
import { execSync } from "child_process";
import { CapabilityExport } from "../../lib/types";
import { Capability } from "../../lib/core/capability";
import Log from "../../lib/telemetry/logger";

vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actual,
    accessSync: vi.fn(),
    constants: { F_OK: 0 },
    statSync: vi.fn(() => ({
      isFile: () => true,
    })),
  };
});

vi.mock("../../lib/telemetry/logger", () => ({
  __esModule: true,
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("../../lib/included-files", () => ({
  createDockerfile: vi.fn(),
}));

vi.mock("../../lib/filesystemService", () => ({
  createDirectoryIfNotExists: vi.fn(),
}));
describe("fileExists", () => {
  const mockedAccessSync = vi.mocked(accessSync);

  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("logs and exits when the input is a directory", () => {
    mockedAccessSync.mockImplementationOnce(() => {
      throw new Error("ENOENT");
    });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });
    const logSpy = vi.spyOn(Log, "error").mockImplementation(() => {});
    expect(() => fileExists("/tmp/overthere")).toThrow("exit");
    expect(logSpy).toHaveBeenCalledWith(
      "The entry-point option requires a file (e.g., pepr.ts), /tmp/overthere is not a file",
    );
    exitSpy.mockRestore();
  });
  it("returns the entry point when the file exists", () => {
    mockedAccessSync.mockImplementationOnce(() => {});
    const entry = "kfc.ts";
    const result = fileExists(entry);
    expect(mockedAccessSync).toHaveBeenCalledWith(resolve(entry), constants.F_OK);
    expect(result).toBe(entry);
  });

  it("logs and exits when the file is missing", () => {
    mockedAccessSync.mockImplementationOnce(() => {
      throw new Error("ENOENT");
    });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });
    expect(() => fileExists("missing.ts")).toThrow("exit");
    exitSpy.mockRestore();
  });

  it("uses default arg when no entry is provided", () => {
    mockedAccessSync.mockImplementationOnce(() => {});
    expect(fileExists()).toBe("pepr.ts");
    expect(mockedAccessSync).toHaveBeenCalledWith(resolve("pepr.ts"), constants.F_OK);
  });
});
describe("assignImage", () => {
  const mockPeprVersion = "1.0.0";

  it("should return the customImage if provided", () => {
    const result = assignImage({
      customImage: "pepr:dev",
      registryInfo: "docker.io/defenseunicorns",
      peprVersion: mockPeprVersion,
      registry: "my-registry",
    });
    expect(result).toBe("pepr:dev");
  });

  it("should return registryInfo with custom-pepr-controller and peprVersion if customImage is not provided", () => {
    const result = assignImage({
      customImage: "",
      registryInfo: "docker.io/defenseunicorns",
      peprVersion: mockPeprVersion,
      registry: "my-registry",
    });
    expect(result).toBe(`docker.io/defenseunicorns/custom-pepr-controller:1.0.0`);
  });

  it("should return IronBank image if registry is provided and others are not", () => {
    const result = assignImage({
      customImage: "",
      registryInfo: "",
      peprVersion: mockPeprVersion,
      registry: "Iron Bank",
    });
    expect(result).toBe(
      `registry1.dso.mil/ironbank/opensource/defenseunicorns/pepr/controller:v${mockPeprVersion}`,
    );
  });

  it("should return an empty string if none of the conditions are met", () => {
    const result = assignImage({
      customImage: "",
      registryInfo: "",
      peprVersion: "",
      registry: "",
    });
    expect(result).toBe("");
  });
});

describe("determineRbacMode", () => {
  it("should allow CLI options to overwrite module config", () => {
    const opts = { rbacMode: "admin" };
    const cfg = { pepr: { rbacMode: "scoped" } };
    const result = determineRbacMode(opts, cfg);
    expect(result).toBe("admin");
  });

  it('should return "admin" when cfg.pepr.rbacMode is provided and not "scoped"', () => {
    const opts = {};
    const cfg = { pepr: { rbacMode: "admin" } };
    const result = determineRbacMode(opts, cfg);
    expect(result).toBe("admin");
  });

  it('should return "scoped" when cfg.pepr.rbacMode is "scoped"', () => {
    const opts = {};
    const cfg = { pepr: { rbacMode: "scoped" } };
    const result = determineRbacMode(opts, cfg);
    expect(result).toBe("scoped");
  });

  it("should default to admin when neither option is provided", () => {
    const opts = {};
    const cfg = { pepr: {} };
    const result = determineRbacMode(opts, cfg);
    expect(result).toBe("admin");
  });
});

describe("createOutputDirectory", () => {
  const mockedCreateDirectoryIfNotExists = vi.mocked(createDirectoryIfNotExists);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return the provided output directory if it exists and is created successfully", async () => {
    mockedCreateDirectoryIfNotExists.mockResolvedValueOnce();

    const outputDir = "custom-output-dir";
    const result = await createOutputDirectory(outputDir);

    expect(mockedCreateDirectoryIfNotExists).toHaveBeenCalledWith(outputDir);
    expect(result).toBe(outputDir);
  });

  it("should return the default output directory if an empty string is provided", async () => {
    mockedCreateDirectoryIfNotExists.mockResolvedValueOnce();
    const outputDir = "";
    const result = await createOutputDirectory(outputDir);
    expect(mockedCreateDirectoryIfNotExists).toHaveBeenCalledWith("dist");
    expect(result).toBe("dist");
  });
});

describe("checkIronBankImage", () => {
  it("should return the Iron Bank image if the registry is Iron Bank", () => {
    const registry = "Iron Bank";
    const image = "ghcr.io/defenseunicorns/pepr/controller:v0.0.1";
    const peprVersion = "0.0.1";
    const result = checkIronBankImage(registry, image, peprVersion);
    expect(result).toBe(
      `registry1.dso.mil/ironbank/opensource/defenseunicorns/pepr/controller:v${peprVersion}`,
    );
  });

  it("should return the image if the registry is not Iron Bank", () => {
    const registry = "GitHub";
    const image = "ghcr.io/defenseunicorns/pepr/controller:v0.0.1";
    const peprVersion = "0.0.1";
    const result = checkIronBankImage(registry, image, peprVersion);
    expect(result).toBe(image);
  });
});

describe("validImagePullSecret", () => {
  it("should not throw an error if the imagePullSecret is valid", () => {
    const imagePullSecret = "valid-secret";
    const result = validImagePullSecret(imagePullSecret);
    expect(result).toBe(true);
  });
  it("should not throw an error if the imagePullSecret is empty", () => {
    const imagePullSecret = "";
    const result = validImagePullSecret(imagePullSecret);
    expect(result).toBe(true);
  });
  it("should throw an error if the imagePullSecret is invalid", () => {
    const imagePullSecret = "invalid name";
    const result = validImagePullSecret(imagePullSecret);
    expect(result).toBe(false);
  });
});

describe("handleCustomImageBuild", () => {
  const mockedExecSync = vi.mocked(execSync);
  const mockedCreateDockerfile = vi.mocked(createDockerfile);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call createDockerfile and execute docker commands if includedFiles is not empty", async () => {
    const includedFiles = ["file1", "file2"];
    const peprVersion = "1.0.0";
    const description = "Test Description";
    const image = "test-image";

    await handleCustomImageBuild(includedFiles, peprVersion, description, image);

    expect(mockedCreateDockerfile).toHaveBeenCalledWith(peprVersion, description, includedFiles);
    expect(mockedExecSync).toHaveBeenCalledWith(
      `docker build --tag ${image} -f Dockerfile.controller .`,
      {
        stdio: "inherit",
      },
    );
    expect(mockedExecSync).toHaveBeenCalledWith(`docker push ${image}`, { stdio: "inherit" });
  });

  it("should not call createDockerfile or execute docker commands if includedFiles is empty", async () => {
    const includedFiles: string[] = [];
    const peprVersion = "1.0.0";
    const description = "Test Description";
    const image = "test-image";

    await handleCustomImageBuild(includedFiles, peprVersion, description, image);

    expect(mockedCreateDockerfile).not.toHaveBeenCalled();
    expect(mockedExecSync).not.toHaveBeenCalled();
  });
});
describe("handleValidCapabilityNames", () => {
  let mockExit: MockInstance<(code?: number | string | null | undefined) => never>;
  let consoleErrorSpy: MockInstance<(message?: unknown, ...optionalParams: unknown[]) => void>;
  beforeEach(() => {
    vi.clearAllMocks();
    mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      return undefined as never;
    });
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should call validateCapabilityNames with capabilities", () => {
    const capability = new Capability({
      name: "test",
      description: "test",
    });

    const capabilityExports: CapabilityExport[] = [
      {
        name: capability.name,
        description: capability.description,
        namespaces: capability.namespaces,
        bindings: capability.bindings,
        hasSchedule: capability.hasSchedule,
      },
    ];

    handleValidCapabilityNames(capabilityExports);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(mockExit).not.toHaveBeenCalled();
  });
  it("should call validateCapabilityNames with capabilities", () => {
    const capability = new Capability({
      name: "test $me",
      description: "test",
    });

    const capabilityExports: CapabilityExport[] = [
      {
        name: capability.name,
        description: capability.description,
        namespaces: capability.namespaces,
        bindings: capability.bindings,
        hasSchedule: capability.hasSchedule,
      },
    ];
    handleValidCapabilityNames(capabilityExports);
    expect(consoleErrorSpy.mock.calls[0][0]).toBe(`Error loading capability:`);
    expect(mockExit).toHaveBeenCalled();
  });
});
