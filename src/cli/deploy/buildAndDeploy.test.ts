import { describe, vi, beforeEach, it, expect } from "vitest";
import { buildAndDeployModule } from "./buildAndDeploy";

const h = vi.hoisted(() => ({
  deploySpy: vi.fn(),
}));

vi.mock("../build/buildModule", () => ({
  buildModule: vi.fn(),
}));

vi.mock("../../lib/assets/loader", () => ({
  loadCapabilities: vi.fn(),
}));

vi.mock("../../lib/helpers", () => ({
  validateCapabilityNames: vi.fn(),
}));

vi.mock("../../lib/deploymentChecks", () => ({
  namespaceDeploymentsReady: vi.fn(),
}));

vi.mock("../../lib/assets/assets", () => {
  type AssetsCtorCfg = { description: string } & Record<string, unknown>;

  class MockAssets {
    path: string = "dist/test-module";
    image: string = "";
    config: { admission: Record<string, never>; watch: Record<string, never> } = {
      admission: {},
      watch: {},
    };
    alwaysIgnore: Record<string, never> = {};
    capabilities: Array<{ name?: string }> = [];

    constructor(_cfg: AssetsCtorCfg, path: string) {
      if (path) this.path = path;
    }

    deploy = h.deploySpy;
  }

  return { Assets: MockAssets };
});

const deploySpy = h.deploySpy;
describe("buildAndDeployModule", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it("builds and deploys the module", async () => {
    const { buildModule } = await import("../build/buildModule");
    (buildModule as ReturnType<typeof vi.fn>).mockResolvedValue({
      cfg: {
        pepr: { webhookTimeout: 10 },
        description: "Test Module",
      },
      path: "dist/test-module",
    });

    const { loadCapabilities } = await import("../../lib/assets/loader");
    (loadCapabilities as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await buildAndDeployModule("test-image", false);

    expect(buildModule).toHaveBeenCalledWith("dist", {});
    expect(deploySpy).toHaveBeenCalled();

    const { validateCapabilityNames } = await import("../../lib/helpers");
    expect(validateCapabilityNames).toHaveBeenCalled();

    const { namespaceDeploymentsReady } = await import("../../lib/deploymentChecks");
    expect(namespaceDeploymentsReady).toHaveBeenCalled();
  });
});
