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
  },
}));

vi.spyOn(process, "exit");

const mockedHash = "cccc02c4d7707ff4a7d8ba5c6e646aee32abc2765c2818bf28c54bfd7fb89bfd";
const gzPath = `/app/load/module-${mockedHash}.js.gz`;
const jsPath = `/app/module-${mockedHash}.js`;
const codeBuffer = Buffer.from("controller-test");

describe("when the controller starts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should run the module if hashes match", async () => {
    const { K8s } = await import("kubernetes-fluent-client");
    (K8s as Mock).mockReturnValue({ Apply: vi.fn().mockResolvedValueOnce(undefined) });

    await startup(mockedHash);

    expect(fs.existsSync).toHaveBeenCalledWith(gzPath);
    expect(fs.readFileSync).toHaveBeenCalledWith(gzPath);
    expect(fs.writeFileSync).toHaveBeenCalledWith(jsPath, codeBuffer);
    expect(fork).toHaveBeenCalledWith(jsPath);
  });
  describe("when startup experiences an error", () => {
    const runAndExpectError = async (hash: string) => {
      await expect(startup(hash)).rejects.toThrow('process.exit unexpectedly called with "1"');
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(Log.error).toHaveBeenCalledWith(expect.anything(), "Error starting Pepr Store CRD");
      expect(fork).not.toHaveBeenCalled();
    };

    it("should exit when file hashes do not match", async () => {
      const { K8s } = await import("kubernetes-fluent-client");
      (K8s as Mock).mockReturnValue({ Apply: vi.fn().mockResolvedValueOnce(undefined) });

      await runAndExpectError(mockedHash.replaceAll("c", "d"));

      expect(Log.error).toHaveBeenCalledWith(expect.anything(), "Error starting Pepr Store CRD");
      expect(fs.existsSync).toHaveBeenCalledWith(
        expect.stringMatching(/\/app\/load\/module-.*\.js\.gz/),
      );
      expect(fs.readFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/\/app\/load\/module-.*\.js\.gz/),
      );
      expect(fs.writeFileSync).not.toHaveBeenCalledWith();
    });

    it("should exit if a file is not found", async () => {
      (fs.existsSync as Mock).mockReturnValueOnce(false);

      await runAndExpectError(mockedHash);

      expect(Log.error).toHaveBeenCalledWith(
        Error(`File not found: /app/load/module-${mockedHash}.js.gz`),
        "Error starting Pepr Store CRD",
      );
    });

    it("should log an error and exit on Apply failure", async () => {
      const { K8s } = await import("kubernetes-fluent-client");
      (K8s as Mock).mockReturnValue({ Apply: new Error("fail") });

      await runAndExpectError(mockedHash);
    });
  });
});
