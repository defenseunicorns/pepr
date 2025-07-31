import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { runModule, startup } from "./controller";
import * as fs from "fs";
import { gunzipSync } from "zlib";
import crypto from "crypto";
import { fork } from "child_process";

vi.mock("fs");
vi.mock("zlib", () => ({
  gunzipSync: vi.fn(),
}));
vi.mock("child_process", () => ({
  fork: vi.fn(),
}));
vi.mock("../lib/helpers", () => ({
  validateHash: vi.fn(),
}));
vi.mock("kubernetes-fluent-client", () => ({
  K8s: vi.fn(),
  kind: {
    CustomResourceDefinition: "CustomResourceDefinition",
  },
  GenericKind: vi.fn(),
  RegisterKind: vi.fn(),
}));
vi.mock("../lib/assets/store", () => ({
  peprStoreCRD: {},
}));
vi.mock("../lib/telemetry/logger", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    level: "info",
  },
}));

const hashed = crypto.createHash("sha256").update("controller-test").digest("hex");
const gzPath = `/app/load/module-${hashed}.js.gz`;
const jsPath = `/app/module-${hashed}.js`;
const codeBuffer = Buffer.from("controller-test");

describe("runModule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs the module if hash matches", () => {
    (fs.existsSync as Mock).mockReturnValue(true);
    (fs.readFileSync as Mock).mockReturnValue(Buffer.from("gzipped"));
    (gunzipSync as Mock).mockReturnValue(codeBuffer);

    expect(() => runModule(hashed)).not.toThrow();
    expect(fs.existsSync).toHaveBeenCalledWith(gzPath);
    expect(fs.readFileSync).toHaveBeenCalledWith(gzPath);
    expect(fs.writeFileSync).toHaveBeenCalledWith(jsPath, codeBuffer);
    expect(fork).toHaveBeenCalledWith(jsPath);
  });

  it("throws if file not found", () => {
    (fs.existsSync as Mock).mockReturnValue(false);
    expect(() => runModule(hashed)).toThrow("File not found");
  });

  it("throws if hash doesn't match", () => {
    (fs.existsSync as Mock).mockReturnValue(true);
    (fs.readFileSync as Mock).mockReturnValue(Buffer.from("gzipped"));
    (gunzipSync as Mock).mockReturnValue(Buffer.from("bad code"));
    expect(() => runModule(hashed)).toThrow("File hash does not match");
  });
});

describe("startup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs error and exits on Apply failure", async () => {
    const { K8s } = await import("kubernetes-fluent-client");
    const applyMock = vi.fn().mockRejectedValue(new Error("fail"));
    (K8s as Mock).mockReturnValue({ Apply: applyMock });

    const exitSpy = vi.spyOn(process, "exit") as Mock;

    exitSpy.mockImplementation((code?: unknown) => {
      throw new Error(`process.exit called with ${code}`);
    });

    await expect(startup()).rejects.toThrow("process.exit called with 1");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
