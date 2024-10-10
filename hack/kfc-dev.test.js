const { expect } = require("@jest/globals");
const { execSync } = require("node:child_process");
const fs = require("fs");
const path = require("path");
const { beforeEach } = require("node:test");

describe("KFC Dev Helper E2E Test", () => {
  beforeEach(() => {
    try {
      fs.rmSync("kubernetes-fluent-client", { recursive: true, force: true });
      execSync("docker rmi pepr");
    } catch (err) {}
  });

  afterAll(() => {
    try {
      fs.rmSync("kubernetes-fluent-client", { recursive: true, force: true });
    } catch {}
  });

  it("should display usage information if no command is provided", () => {
    try {
      execSync("node hack/kfc-dev.js", {
        stdio: "pipe",
        encoding: "utf8",
      });
    } catch (error) {
      expect(error.stdout.toString()).toContain("Usage:");
    }
  });

  it("should fail if flag is missing for build", () => {
    try {
      execSync("node hack/kfc-dev.js build", {
        stdio: "pipe",
        encoding: "utf8",
      });
    } catch (error) {
      expect(error.stderr.toString()).toContain("Please provide a flag.");
    }
  });

  it("should fail if flag is missing for import", () => {
    try {
      execSync("node hack/kfc-dev.js import", {
        stdio: "pipe",
        encoding: "utf8",
      });
    } catch (error) {
      expect(error.stderr.toString()).toContain("Please provide a flag.");
    }
  });

  it("should download a remote branch of KFC to kubernetes-fluent-client folder", () => {
    execSync("node hack/kfc-dev.js build -r main", {
      stdio: "pipe",
      encoding: "utf8",
    });
    expect(fs.existsSync("kubernetes-fluent-client")).toBe(true);

    let dockerOutput = execSync("docker images");
    expect(dockerOutput.toString()).toContain("pepr");
  });

  // requires Kubernetes Fluent Client to be in the same parent directory as Pepr
  it("should import a local KFC to kubernetes-fluent-client folder", () => {
    execSync("node hack/kfc-dev.js build -l ../../kubernetes-fluent-client", {
      stdio: "pipe",
      encoding: "utf8",
    });
    expect(fs.existsSync("kubernetes-fluent-client")).toBe(true);

    let dockerOutput = execSync("docker images");
    expect(dockerOutput.toString()).toContain("pepr");
  });

  it("should import a path of KFC to appropriate folders", () => {
    execSync("node hack/kfc-dev.js import -l ../../kubernetes-fluent-client", {
      stdio: "pipe",
      encoding: "utf8",
    });
    expect(fs.existsSync("node_modules/kubernetes-fluent-client/src")).toBe(true);
    expect(fs.existsSync("node_modules/kubernetes-fluent-client/dist")).toBe(true);
  });
});
