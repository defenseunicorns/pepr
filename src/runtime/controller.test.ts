import { validateHash, ValidationError } from "./controller";
import { describe, it, expect } from "@jest/globals";

describe("validateHash", () => {
  it("should throw ValidationError for invalid hash values", () => {
    // Examples of invalid hashes
    const invalidHashes = [
      "", // Empty string
      "12345", // Too short
      "zxcvbnmasdfghjklqwertyuiop1234567890zxcvbnmasdfghjklqwertyuio", // Contains invalid character 'z'
      "123456789012345678901234567890123456789012345678901234567890123", // 63 characters, one short
    ];

    invalidHashes.forEach(hash => {
      expect(() => validateHash(hash)).toThrow(ValidationError);
    });
  });

  it("should not throw ValidationError for valid SHA-256 hash", () => {
    // Example of a valid SHA-256 hash
    const validHash = "abc123def456abc123def456abc123def456abc123def456abc123def456abc1";
    expect(() => validateHash(validHash)).not.toThrow();
  });
});
