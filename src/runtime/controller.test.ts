import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { startup } from "./controller";
import fs from "fs";
import { fork } from "child_process";
import Log from "../lib/telemetry/logger";

vi.mock("fs", () => ({
  __esModule: true,
  default: {
    ...vi.importActual("fs"),
    existsSync: vi.fn().mockReturnValue(true),
    readFileSync: vi.fn().mockReturnValue(Buffer.from("gzipped")),
    writeFileSync: vi.fn(),
  },
}));

vi.mock("zlib", () => ({
  __esModule: true,
  ...vi.importActual("zlib"),
  gunzipSync: vi.fn().mockReturnValue(Buffer.from("controller-test")),
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

const mockedHash = "cccc02c4d7707ff4a7d8ba5c6e646aee32abc2765c2818bf28c54bfd7fb89bfd";
const gzPath = `/app/load/module-${mockedHash}.js.gz`;
const jsPath = `/app/module-${mockedHash}.js`;
const codeBuffer = Buffer.from("controller-test");

describe("runModule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs the module if hash matches", async () => {
    const { K8s } = await import("kubernetes-fluent-client");
    const applyMock = vi.fn().mockResolvedValue(undefined);
    (K8s as Mock).mockReturnValue({ Apply: applyMock });

    await startup(mockedHash);

    expect(fs.existsSync).toHaveBeenCalledWith(gzPath);
    expect(fs.readFileSync).toHaveBeenCalledWith(gzPath);
    expect(fs.writeFileSync).toHaveBeenCalledWith(jsPath, codeBuffer);
    expect(fork).toHaveBeenCalledWith(jsPath);
  });

  it("throws in hash doesn't match", async () => {
    const { K8s } = await import("kubernetes-fluent-client");
    const applyMock = vi.fn().mockResolvedValue(undefined);
    (K8s as Mock).mockReturnValue({ Apply: applyMock });

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    (fs.existsSync as Mock).mockReturnValue(true);
    (fs.readFileSync as Mock).mockReturnValue(Buffer.from("gzipped"));

    await expect(startup("invalid")).rejects.toThrow("process.exit called");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(fs.existsSync).toHaveBeenCalledWith(
      expect.stringMatching(/\/app\/load\/module-.*\.js\.gz/),
    );
    expect(fs.readFileSync).toHaveBeenCalledWith(
      expect.stringMatching(/\/app\/load\/module-.*\.js\.gz/),
    );
    expect(fs.writeFileSync).not.toHaveBeenCalledWith();
    expect(fork).not.toHaveBeenCalled();
  });

  it("throws if file not found", async () => {
    // Mock existsSync to return false for this test only
    (fs.existsSync as Mock).mockReturnValueOnce(false);
    await expect(startup(mockedHash)).rejects.toThrow();
    expect(Log.error).toHaveBeenCalledWith(
      Error(
        "File not found: /app/load/module-cccc02c4d7707ff4a7d8ba5c6e646aee32abc2765c2818bf28c54bfd7fb89bfd.js.gz",
      ),
      "Error starting Pepr Store CRD",
    );
    expect(process.exit).toHaveBeenCalledWith(1);
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

    await expect(startup(mockedHash)).rejects.toThrow("process.exit called with 1");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
