// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import {
  validateImagePullSecretDetails,
  getUserConfirmation,
  generateImagePullSecret,
  buildAndDeployModule,
} from "./deploy";
import prompt from "prompts";
import type { ImagePullSecretDetails } from "./deploy";

vi.mock("prompts", () => ({
  default: vi.fn(),
}));
vi.mock("./build/buildModule", () => ({
  buildModule: vi.fn(),
}));
vi.mock("../lib/assets/deploy", () => ({
  deployWebhook: vi.fn(),
}));
vi.mock("../lib/deploymentChecks", () => ({
  namespaceDeploymentsReady: vi.fn(),
}));
vi.mock("../lib/helpers", () => ({
  validateCapabilityNames: vi.fn(),
  namespaceComplianceValidator: vi.fn(),
}));
vi.mock("../lib/assets/loader", () => ({
  loadCapabilities: vi.fn(),
}));

const deploySpy = vi.fn();

vi.mock("../lib/assets/assets", () => ({
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
    buildModule = (await import("./build/buildModule")).buildModule as Mock;
    namespaceDeploymentsReady = (await import("../lib/deploymentChecks"))
      .namespaceDeploymentsReady as Mock;
    validateCapabilityNames = (await import("../lib/helpers")).validateCapabilityNames as Mock;
    loadCapabilities = (await import("../lib/assets/loader")).loadCapabilities as Mock;

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

describe("generateImagePullSecret", () => {
  it("generates a valid image pull secret", () => {
    const details = {
      pullSecret: "valid-name",
      dockerEmail: "test@example.com",
      dockerServer: "docker.io",
      dockerUsername: "user",
      dockerPassword: "pass",
    };
    const secret = generateImagePullSecret(details);
    expect(secret).toEqual({
      auths: {
        [details.dockerServer!]: {
          username: details.dockerUsername,
          password: details.dockerPassword,
          email: details.dockerEmail,
          auth: expect.any(String),
        },
      },
    });
  });
});

describe("validateImagePullSecretDetails", () => {
  it("returns valid when pullSecret is not provided", () => {
    const result = validateImagePullSecretDetails({});
    expect(result.valid).toBe(true);
  });

  it("returns error when pullSecret is invalid", () => {
    const result = validateImagePullSecretDetails({ pullSecret: "INVALID_NAME!" });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("RFC 1123");
  });

  it("returns error when pullSecret is valid but missing docker fields", () => {
    const result = validateImagePullSecretDetails({ pullSecret: "valid-name" });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("--docker-email");
    expect(result.error).toContain("--docker-server");
    expect(result.error).toContain("--docker-username");
    expect(result.error).toContain("--docker-password");
  });

  it("returns valid when all required docker fields are provided", () => {
    const input: ImagePullSecretDetails = {
      pullSecret: "valid-name",
      dockerEmail: "test@example.com",
      dockerServer: "server",
      dockerUsername: "user",
      dockerPassword: "pass",
    };
    const result = validateImagePullSecretDetails(input);
    expect(result.valid).toBe(true);
  });
});

describe("getUserConfirmation", () => {
  const mockPrompt = prompt as unknown as Mock;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true if yes option is passed", async () => {
    const result = await getUserConfirmation({ yes: true });
    expect(result).toBe(true);
  });

  it("returns true if user confirms", async () => {
    mockPrompt.mockResolvedValue({ yes: true });
    const result = await getUserConfirmation({ yes: false });
    expect(result).toBe(true);
  });

  it("returns false if user declines", async () => {
    mockPrompt.mockResolvedValue({ yes: false });
    const result = await getUserConfirmation({ yes: false });
    expect(result).toBe(false);
  });
});
