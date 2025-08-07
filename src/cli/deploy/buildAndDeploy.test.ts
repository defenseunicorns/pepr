import { describe, vi, beforeEach, Mock, it, expect } from "vitest";
import { buildAndDeployModule } from "./buildAndDeploy";

vi.mock("../build/buildModule", () => ({
  buildModule: vi.fn(),
}));

vi.mock("../../lib/assets/loader", () => ({
  loadCapabilities: vi.fn(),
}));

vi.mock("../../lib/helpers", () => ({
  validateCapabilityNames: vi.fn(),
  namespaceComplianceValidator: vi.fn(),
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
  let buildModule: ReturnType<typeof vi.fn>;
  let namespaceDeploymentsReady: ReturnType<typeof vi.fn>;
  let validateCapabilityNames: ReturnType<typeof vi.fn>;
  let loadCapabilities: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    buildModule = (await import("../build/buildModule")).buildModule as Mock;
    namespaceDeploymentsReady = (await import("../../lib/deploymentChecks"))
      .namespaceDeploymentsReady as Mock;
    validateCapabilityNames = (await import("../../lib/helpers")).validateCapabilityNames as Mock;
    loadCapabilities = (await import("../../lib/assets/loader")).loadCapabilities as Mock;

    vi.clearAllMocks();
    deploySpy.mockClear(); // Reset the deploy method
  });

  it("builds and deploys the module", async () => {
    buildModule.mockResolvedValue({
      cfg: {
        pepr: { webhookTimeout: 10 },
        description: "Test Module",
      },
      path: "dist/test-module",
    });

    loadCapabilities.mockResolvedValue([]);

    await buildAndDeployModule("test-image", false);

    expect(buildModule).toHaveBeenCalledWith("dist");
    expect(deploySpy).toHaveBeenCalled();
    expect(validateCapabilityNames).toHaveBeenCalled();
    expect(namespaceDeploymentsReady).toHaveBeenCalled();
  });
});
