// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import stream from "stream";
import { Command } from "commander";
import monitor, {
  getLabelsAndErrorMessage,
  getK8sLogFromKubeConfig,
  processMutateLog,
  processValidateLog,
  createLogStream,
  processLogLine,
} from "./monitor";
import { Log } from "@kubernetes/client-node";

const mockLogFn = vi.fn();
const mockLoadFromDefault = vi.fn();

class MockKubeConfig {
  public clusters = [];
  public users = [];
  public contexts = [];
  public currentContext = "";
  public custom_authenticators = [];
  public addAuthenticator = vi.fn();
  public getContexts = vi.fn();
  public setCurrentContext = vi.fn();
  public getCluster = vi.fn();
  public getUser = vi.fn();
  public getCurrentCluster = vi.fn();
  public getCurrentUser = vi.fn();
  public loadFromDefault = mockLoadFromDefault;
}

const mockKubeConfigInstance = new MockKubeConfig();

const mockLogInstance = {
  log: mockLogFn,
  config: mockKubeConfigInstance,
};

vi.mock("@kubernetes/client-node", async () => {
  const actual =
    await vi.importActual<typeof import("@kubernetes/client-node")>("@kubernetes/client-node");
  return {
    ...actual,
    KubeConfig: vi.fn(() => mockKubeConfigInstance),
    Log: vi.fn(() => mockLogInstance),
  };
});

vi.mock("kubernetes-fluent-client", () => ({
  kind: {
    Pod: {
      InNamespace: () => ({
        WithLabel: () => ({
          Get: vi.fn().mockResolvedValue({
            items: [{ metadata: { name: "test-pod-1" } }, { metadata: { name: "test-pod-2" } }],
          }),
        }),
      }),
    },
  },
  K8s: vi.fn(() => ({
    InNamespace: () => ({
      WithLabel: () => ({
        Get: vi.fn().mockResolvedValue({
          items: [{ metadata: { name: "test-pod-1" } }, { metadata: { name: "test-pod-2" } }],
        }),
      }),
    }),
  })),
}));

const mockLogStream = new stream.PassThrough();

const payload = {
  msg: "Check response",
  name: "test-name",
  namespace: "test-ns",
  uid: "test-uid",
  res: {
    allowed: true,
    uid: "test-uid",
    patch: btoa(JSON.stringify({ key: "value" })),
    patchType: "test-patch-type",
    status: { message: "msg" },
  },
};

describe("monitor command", () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    monitor(program);

    vi.spyOn({ getK8sLogFromKubeConfig }, "getK8sLogFromKubeConfig").mockReturnValue(
      mockLogInstance as unknown as Log,
    );
    vi.spyOn({ createLogStream }, "createLogStream").mockReturnValue(mockLogStream);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should stream logs for each pod found", async () => {
    const cmd = program.commands.find(c => c.name() === "monitor");
    await cmd?.parseAsync(["test-uuid"], { from: "user" });

    expect(mockLogFn).toHaveBeenCalledTimes(2);
    expect(mockLogFn).toHaveBeenCalledWith(
      "pepr-system",
      "test-pod-1",
      "server",
      expect.any(stream.PassThrough),
      expect.objectContaining({ follow: true }),
    );
    expect(mockLogFn).toHaveBeenCalledWith(
      "pepr-system",
      "test-pod-2",
      "server",
      expect.any(stream.PassThrough),
      expect.objectContaining({ follow: true }),
    );
  });
});

describe("getK8sLogFromKubeConfig", () => {
  it("should create a K8sLog instance from the default KubeConfig", () => {
    const result = getK8sLogFromKubeConfig();
    expect(mockLoadFromDefault).toHaveBeenCalledTimes(1);
    expect(result).toBe(mockLogInstance);
  });
});

describe("getLabelsAndErrorMessage", () => {
  it.each([
    [
      undefined,
      {
        labels: ["pepr.dev/controller", "admission"],
        errorMessage: "No pods found with admission labels",
      },
    ],
    ["test", { labels: ["app", "pepr-test"], errorMessage: "No pods found for module test" }],
    ["test2", { labels: ["app", "pepr-test2"], errorMessage: "No pods found for module test2" }],
    ["test3", { labels: ["app", "pepr-test3"], errorMessage: "No pods found for module test3" }],
    ["test4", { labels: ["app", "pepr-test4"], errorMessage: "No pods found for module test4" }],
  ])("should return labels and error message", (uuid, expected) => {
    const result = getLabelsAndErrorMessage(uuid);
    expect(result).toEqual(expected);
  });
});

describe("processMutateLog", () => {
  let consoleLogSpy: MockInstance<(message?: unknown, ...optionalParams: unknown[]) => void>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should log a mutation approval with patch details", () => {
    processMutateLog(
      {
        ...payload,
        res: {
          ...payload.res,
          patch: btoa(JSON.stringify({ key: "value" })),
          patchType: "JSONPatch",
        },
      },
      "test-name",
      "test-uid",
    );

    expect(consoleLogSpy).toHaveBeenCalledWith("\n🔀  MUTATE     test-name (test-uid)");
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(JSON.stringify({ key: "value" }, null, 2)),
    );
  });

  it("should log a mutation denial without patch details", () => {
    processMutateLog(
      {
        ...payload,
        res: {
          ...payload.res,
          allowed: false,
          patch: btoa(JSON.stringify("something")),
        },
      },
      "test-name",
      "test-uid",
    );

    expect(consoleLogSpy).toHaveBeenCalledWith("\n🚫  MUTATE     test-name (test-uid)");
    expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining("{"));
  });
});

describe("processValidateLog", () => {
  let consoleLogSpy: MockInstance<(message?: unknown, ...optionalParams: unknown[]) => void>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should log a successful validation", () => {
    processValidateLog(payload, "test-name", "test-uid");

    expect(consoleLogSpy).toHaveBeenCalledWith("\n✅  VALIDATE   test-name (test-uid)");
    expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining("❌"));
  });

  it("should log a validation failure with error messages", () => {
    processValidateLog(
      {
        ...payload,
        res: {
          ...payload.res,
          allowed: false,
          status: { message: "Failure message 1" },
        },
      },
      "test-name",
      "test-uid",
    );

    expect(consoleLogSpy).toHaveBeenCalledWith("\n❌  VALIDATE   test-name (test-uid)");
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Failure message 1"));
  });
});

describe("processLogLine", () => {
  let logSpy: MockInstance<(message?: unknown, ...optionalParams: unknown[]) => void>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should handle valid mutate log line", () => {
    const logLine = JSON.stringify({
      msg: "Check response",
      namespace: "ns-",
      name: "pod",
      res: {
        uid: "abc123",
        allowed: true,
        patchType: "JSONPatch",
        patch: btoa(JSON.stringify({ foo: "bar" })),
      },
    });

    processLogLine(logLine);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("MUTATE"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("foo"));
  });

  it("should handle valid validate log line with allowed=true", () => {
    const logLine = JSON.stringify({
      msg: "Check response",
      namespace: "ns-",
      name: "pod",
      res: {
        uid: "val123",
        allowed: true,
        status: { message: "" },
      },
    });

    processLogLine(logLine);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("VALIDATE"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("✅"));
  });

  it("should handle validation failure", () => {
    const logLine = JSON.stringify({
      msg: "Check response",
      namespace: "ns-",
      name: "pod",
      res: {
        uid: "fail123",
        allowed: false,
        status: { message: "you shall not pass" },
      },
    });

    processLogLine(logLine);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("❌"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("you shall not pass"));
  });

  it("should not throw on invalid JSON", () => {
    expect(() => processLogLine("{ invalid }")).not.toThrow();
  });

  it("should do nothing if 'msg' field is missing", () => {
    const logLine = JSON.stringify({
      namespace: "ns-",
      name: "pod",
      res: {
        uid: "unknown",
        allowed: true,
      },
    });

    expect(() => processLogLine(logLine)).not.toThrow();
  });
});
