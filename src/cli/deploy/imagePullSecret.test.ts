import { describe, it, expect } from "vitest";
import {
  generateImagePullSecret,
  validateImagePullSecretDetails,
  ImagePullSecretDetails,
} from "./imagePullSecret";

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
