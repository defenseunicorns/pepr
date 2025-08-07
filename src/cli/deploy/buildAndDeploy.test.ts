import { describe, vi, beforeEach, it, expect } from "vitest";
import { buildAndDeployModule } from "./buildAndDeploy";

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

const deploySpy = vi.fn();
vi.mock("../../lib/assets/assets", () => ({
  Assets: vi.fn().mockImplementation(() => ({
    deploy: deploySpy,
    path: "dist/test-module",
    image: "",
    config: {
      admission: {},
      watch: {},
    },
    alwaysIgnore: {},
    capabilities: [],
  })),
}));

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

    expect(buildModule).toHaveBeenCalledWith("dist");
    expect(deploySpy).toHaveBeenCalled();

    const { validateCapabilityNames } = await import("../../lib/helpers");
    expect(validateCapabilityNames).toHaveBeenCalled();

    const { namespaceDeploymentsReady } = await import("../../lib/deploymentChecks");
    expect(namespaceDeploymentsReady).toHaveBeenCalled();
  });
});
