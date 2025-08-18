// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { Command } from "commander";
import { promises as fs } from "fs";
import prompts from "prompts";
import devCommand from "./dev";
import { EventEmitter } from "events";
import Log from "../lib/telemetry/logger";

vi.mock("../lib/telemetry/logger", () => ({
  __esModule: true,
  default: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actual,
    promises: {
      ...actual.promises,
      writeFile: vi.fn(),
    },
  };
});

vi.mock("prompts", () => ({
  default: vi.fn(),
}));

vi.mock("./build/loadModule", () => ({
  loadModule: vi.fn().mockResolvedValue({
    cfg: {
      description: "test",
      pepr: { uuid: "1234" },
    },
    path: "./test-module.js",
  }),
}));

vi.mock("./build/buildModule", () => ({
  buildModule: vi.fn().mockImplementation(async (_, cb) => {
    await cb({ errors: [] });
  }),
}));

vi.mock("../lib/assets/assets", () => ({
  Assets: vi.fn().mockImplementation(() => ({
    tls: {
      pem: {
        crt: "mock-cert",
        key: "mock-key",
      },
    },
    apiPath: "/mock/api",
    capabilities: [{ name: "test-cap" }],
    deploy: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("../lib/assets/deploy", () => ({
  deployWebhook: vi.fn(),
}));

vi.mock("../lib/helpers", () => ({
  validateCapabilityNames: vi.fn(),
}));

vi.mock("child_process", () => {
  return {
    fork: vi.fn(() => {
      const mockChild = Object.assign(new EventEmitter(), {
        kill: vi.fn(),
        once: vi.fn((event, cb) => {
          if (event === "exit") cb();
        }),
        on: vi.fn(),
      });
      return mockChild;
    }),
  };
});

vi.mock("kubernetes-fluent-client", () => ({
  K8s: vi.fn(() => ({
    Delete: vi.fn().mockResolvedValue(undefined),
    InNamespace: vi.fn().mockReturnThis(),
  })),
  kind: {
    MutatingWebhookConfiguration: "MutatingWebhookConfiguration",
    ValidatingWebhookConfiguration: "ValidatingWebhookConfiguration",
  },
}));

vi.mock("../lib/k8s", () => ({
  Store: "Store",
}));

describe("dev command", () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    devCommand(program);
  });

  it("should run dev command successfully", async () => {
    const writeFile = fs.writeFile as Mock;
    await program.parseAsync(["dev", "--yes"], { from: "user" });

    expect(prompts).not.toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalledWith("insecure-tls.crt", "mock-cert");
    expect(writeFile).toHaveBeenCalledWith("insecure-tls.key", "mock-key");

    const { validateCapabilityNames } = await import("../lib/helpers");
    expect(validateCapabilityNames).toHaveBeenCalledWith([{ name: "test-cap" }]);
  });

  it("should exit early if user declines prompt", async () => {
    (prompts as unknown as Mock).mockResolvedValueOnce({ yes: false });

    const program = new Command();
    devCommand(program);

    await program.parseAsync(["dev"], { from: "user" });

    expect(prompts).toHaveBeenCalled();
    expect(process.exitCode).toBe(0);
  });

  it("should log error if buildModule has errors", async () => {
    const errorSpy = vi.spyOn(Log, "error").mockImplementation(() => {});
    const { buildModule } = await import("./build/buildModule");
    (buildModule as Mock).mockImplementationOnce(async (_, cb) => {
      await cb({ errors: ["error"] });
    });

    await program.parseAsync(["dev", "--yes"], { from: "user" });
    expect(errorSpy).toHaveBeenCalledWith("Error compiling module: error");
    errorSpy.mockRestore();
  });

  it("should exit if capability validation fails", async () => {
    const { validateCapabilityNames } = await import("../lib/helpers");
    (validateCapabilityNames as Mock).mockImplementation(() => {
      throw new Error("validation failed");
    });

    const errorSpy = vi.spyOn(Log, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });

    await expect(program.parseAsync(["dev", "--yes"], { from: "user" })).rejects.toThrow("exit");

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("CapabilityValidation Error"));
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("should log on SIGINT", async () => {
    const { validateCapabilityNames } = await import("../lib/helpers");
    (validateCapabilityNames as Mock).mockImplementation(() => {});

    const debugSpy = vi.spyOn(Log, "debug").mockImplementation(() => {});
    const processOnSpy = vi.spyOn(process, "on");

    await program.parseAsync(["dev", "--yes"], { from: "user" });

    const sigHandler = processOnSpy.mock.calls.find(([event]) => event === "SIGINT")?.[1];
    sigHandler?.();

    expect(debugSpy).toHaveBeenCalledWith("Received SIGINT, removing webhooks");

    debugSpy.mockRestore();
  });

  it("should use custom host from --host option", async () => {
    const hostArg = "kind-control-plane";
    const AssetsModule = await import("../lib/assets/assets");
    const AssetsMock = AssetsModule.Assets as Mock;

    await program.parseAsync(["dev", "--yes", "--host", hostArg], { from: "user" });

    expect(AssetsMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.any(Array),
      hostArg,
    );
  });
});
