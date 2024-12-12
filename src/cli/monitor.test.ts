// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it, jest, beforeEach, afterEach } from "@jest/globals";
import {
  getLabelsAndErrorMessage,
  getK8sLogFromKubeConfig,
  processMutateLog,
  processValidateLog,
} from "./monitor";
import { KubeConfig, Log as K8sLog } from "@kubernetes/client-node";
import { SpiedFunction } from "jest-mock";

const payload = {
  level: 30,
  time: 1733751945893,
  pid: 1,
  hostname: "test-host",
  uid: "test-uid",
  namespace: "test-namespace",
  name: "test-name",
  res: {
    allowed: true,
    uid: "test-uid",
    patch: btoa(JSON.stringify({ key: "value" })),
    patchType: "test-patch-type",
    warning: "test-warning",
    status: { message: "test-message" },
  },
  msg: "Check response",
};

jest.mock("@kubernetes/client-node", () => {
  const mockKubeConfig = jest.fn();
  mockKubeConfig.prototype.loadFromDefault = jest.fn();
  const mockK8sLog = jest.fn();

  return {
    KubeConfig: mockKubeConfig,
    Log: mockK8sLog,
  };
});

describe("getK8sLogFromKubeConfig", () => {
  it("should create a K8sLog instance from the default KubeConfig", () => {
    const result = getK8sLogFromKubeConfig();
    expect(KubeConfig).toHaveBeenCalledTimes(1);
    expect(KubeConfig.prototype.loadFromDefault).toHaveBeenCalledTimes(1);

    const kubeConfigInstance = new KubeConfig();
    expect(K8sLog).toHaveBeenCalledWith(kubeConfigInstance);

    expect(result).toBeInstanceOf(K8sLog);
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
  let consoleLogSpy: SpiedFunction<{
    (...data: unknown[]): void;
    (message?: unknown, ...optionalParams: unknown[]): void;
  }>;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
  let consoleLogSpy: SpiedFunction<{
    (...data: unknown[]): void;
    (message?: unknown, ...optionalParams: unknown[]): void;
  }>;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
