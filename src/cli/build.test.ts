// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import {
  determineRbacMode,
  handleCustomOutputDir,
  handleValidCapabilityNames,
  handleCustomImageBuild,
  checkIronBankImage,
  validImagePullSecret,
  assignImage,
  // shouldExitEarly,
  // BuildModuleReturn,
  // PeprConfig
} from "./build.helpers";
// import { BuildOptions, BuildContext, BuildResult, ServeResult } from "esbuild";
import { createDirectoryIfNotExists } from "../lib/filesystemService";
import { expect, describe, it, jest, beforeEach } from "@jest/globals";
import { createDockerfile } from "../lib/included-files";
import { execSync } from "child_process";
import { CapabilityExport } from "../lib/types";
import { Capability } from "../lib/core/capability";

jest.mock("child_process", () => ({
  execSync: jest.fn(),
}));

jest.mock("../lib/included-files", () => ({
  createDockerfile: jest.fn(),
}));

jest.mock("../lib/filesystemService", () => ({
  createDirectoryIfNotExists: jest.fn(),
}));

// describe("shouldExitEarly", () => {

//   it("should return true if buildModuleResult is missing required fields", () => {
//     const buildModuleResult: BuildModuleReturn = {} as BuildModuleReturn;
//     const result = shouldExitEarly(buildModuleResult);
//     expect(result).toBe(true);
//   });

//   it("should return false if buildModuleResult has all required fields", () => {
//     const config: PeprConfig = {
//       pepr: {
//         uuid: "some-uuid",
//         onError: "ignore",
//         webhookTimeout: 30,
//         customLabels: {},
//         alwaysIgnore: {
//           namespaces: [],
//         },
//         env: {},
//         rbac: [],
//         rbacMode: "minimal",
//         peprVersion: "1.0.0",
//         includedFiles: [],
//       },
//       description: "A test module",
//       version: "1.0.0",
//     };

//     const mockContext: BuildContext<BuildOptions> = {
//       rebuild: jest.fn<() => Promise<BuildResult<BuildOptions>>>().mockImplementation(() =>
//         Promise.resolve({} as BuildResult<BuildOptions>)
//       ),
//       dispose: jest.fn<() => Promise<void>>().mockImplementation(() => Promise.resolve()),
//       watch: jest.fn<() => Promise<void>>().mockImplementation(() => Promise.resolve()),
//       cancel: jest.fn<() => Promise<void>>().mockImplementation(() => Promise.resolve()),
//       serve: jest.fn<() => Promise<ServeResult>>().mockImplementation(() =>
//         Promise.resolve({ host: "localhost", port: 8000 })
//       ),
//     };
//     const buildModuleResult: BuildModuleReturn = {
//       ctx: mockContext,
//       path: "some-path",
//       cfg: config,
//       uuid: "some-uuid",
//     };
//     const result = shouldExitEarly(buildModuleResult);
//     expect(result).toBe(false);
//   });

//   it("should return true if any field in buildModuleResult is falsy", () => {
//     const buildModuleResult: BuildModuleReturn = {
//       path: "some-path",
//       uuid: "some-uuid",
//     } as BuildModuleReturn;
//     const result = shouldExitEarly(buildModuleResult);
//     expect(result).toBe(true);
//   });
// });

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

describe("handleCustomOutputDir", () => {
  const mockedCreateDirectoryIfNotExists = jest.mocked(createDirectoryIfNotExists);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return the provided output directory if it exists and is created successfully", async () => {
    mockedCreateDirectoryIfNotExists.mockResolvedValueOnce();

    const outputDir = "custom-output-dir";
    const result = await handleCustomOutputDir(outputDir);

    expect(mockedCreateDirectoryIfNotExists).toHaveBeenCalledWith(outputDir);
    expect(result).toBe(outputDir);
  });

  it("should return the default output directory if no custom directory is provided", async () => {
    const outputDir = "";
    const result = await handleCustomOutputDir(outputDir);
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
  const mockExit = jest.spyOn(process, "exit").mockImplementation(() => {
    return undefined as never;
  });

  const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("should not throw an error if the imagePullSecret is valid", () => {
    const imagePullSecret = "valid-secret";
    validImagePullSecret(imagePullSecret);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(mockExit).not.toHaveBeenCalled();
  });
  it("should not throw an error if the imagePullSecret is empty", () => {
    const imagePullSecret = "";
    validImagePullSecret(imagePullSecret);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(mockExit).not.toHaveBeenCalled();
  });
  it("should throw an error if the imagePullSecret is invalid", () => {
    const imagePullSecret = "invalid name";
    validImagePullSecret(imagePullSecret);
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalled();
  });
});

describe("handleCustomImageBuild", () => {
  const mockedExecSync = jest.mocked(execSync);
  const mockedCreateDockerfile = jest.mocked(createDockerfile);

  beforeEach(() => {
    jest.clearAllMocks();
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
  const mockExit = jest.spyOn(process, "exit").mockImplementation(() => {
    return undefined as never;
  });

  const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

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
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalled();
  });
});
