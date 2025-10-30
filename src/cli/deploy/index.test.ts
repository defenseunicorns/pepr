import { describe, it, vi, expect, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import deploy from ".";
import prompts from "prompts";

const h = vi.hoisted(() => ({
  deploySpy: vi.fn(),
}));

vi.mock("prompts", () => {
  return {
    default: vi.fn(),
  };
});

vi.mock("../build/buildModule", () => ({
  buildModule: vi.fn().mockResolvedValue({
    cfg: {
      pepr: { webhookTimeout: 10 },
      description: "Test Module",
    },
    path: "dist/test-module",
  }),
}));

vi.mock("../../lib/assets/deploy", () => ({
  deployImagePullSecret: vi.fn(),
  deployWebhook: vi.fn(),
}));

vi.mock("../../lib/deploymentChecks", () => ({
  namespaceDeploymentsReady: vi.fn(),
}));

vi.mock("../../lib/helpers", () => ({
  validateCapabilityNames: vi.fn(),
  namespaceComplianceValidator: vi.fn(),
}));

vi.mock("../../lib/assets/loader", () => ({
  loadCapabilities: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../lib/assets/assets", () => {
  type Capability = Record<string, unknown>;

  class MockAssets {
    path: string = "dist/test-module";
    image: string = "";
    config: { admission: Record<string, never>; watch: Record<string, never> } = {
      admission: {},
      watch: {},
    };
    alwaysIgnore: Record<string, never> = {};
    capabilities: Capability[] = [];

    // Match the production signature loosely without `any`
    // prod is likely: (cfg: Cfg, path: string, caps?: Capability[], host?: string)
    constructor(...args: unknown[]) {
      const maybePath = typeof args[1] === "string" ? args[1] : undefined;
      if (maybePath) this.path = maybePath;
    }

    deploy = h.deploySpy;
  }

  return { Assets: MockAssets };
});

// Re-export the hoisted spy for assertions below
const deploySpy = h.deploySpy;

describe("deploy CLI command", () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    deploy(program);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("runs build and deploy when no pullSecret is passed and user confirms", async () => {
    const mockExit = vi.spyOn(process, "exit").mockImplementation(code => {
      throw new Error(`process.exit: ${code}`);
    });

    await program.parseAsync(["deploy", "--image", "pepr:dev", "--force", "--yes"], {
      from: "user",
    });

    expect(deploySpy).toHaveBeenCalled();
    expect(
      (await import("../../lib/deploymentChecks")).namespaceDeploymentsReady,
    ).toHaveBeenCalled();

    mockExit.mockRestore();
  });

  it("deploys imagePullSecret and exits early", async () => {
    const deployImagePullSecret = (await import("../../lib/assets/deploy"))
      .deployImagePullSecret as ReturnType<typeof vi.fn>;

    await program.parseAsync(
      [
        "deploy",
        "--pull-secret",
        "valid-name",
        "--docker-email",
        "pepr-dev@defenseunicorns.com",
        "--docker-server",
        "docker.io",
        "--docker-username",
        "pepr-dev",
        "--docker-password",
        "pepr",
      ],
      { from: "user" },
    );

    expect(deployImagePullSecret).toHaveBeenCalled();
  });

  it("prints error and exits on invalid pullSecret name", async () => {
    const mockExit = vi.spyOn(process, "exit").mockImplementation(code => {
      throw new Error(`process.exit: ${code}`);
    });
    const mockError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      program.parseAsync(["deploy", "--pull-secret", "!!bad"], { from: "user" }),
    ).rejects.toThrow("process.exit: 1");

    expect(mockError).toHaveBeenCalledWith(expect.stringContaining("Invalid --pullSecret"));

    mockExit.mockRestore();
    mockError.mockRestore();
  });

  it("exits if user declines confirmation", async () => {
    const mockPrompt = prompts as unknown as ReturnType<typeof vi.fn>;
    mockPrompt.mockResolvedValue({ yes: false });

    const mockExit = vi.spyOn(process, "exit").mockImplementation(code => {
      throw new Error(`process.exit: ${code}`);
    });

    await expect(
      program.parseAsync(["deploy", "--image", "pepr:dev", "--force"], { from: "user" }),
    ).rejects.toThrow("process.exit: 0");

    expect(mockPrompt).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(0);

    mockExit.mockRestore();
  });
});
