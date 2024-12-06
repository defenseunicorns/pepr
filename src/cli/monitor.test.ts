// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, it, jest } from "@jest/globals";
import { getLabelsAndErrorMessage, getK8sLogFromKubeConfig } from "./monitor";
import { KubeConfig, Log as K8sLog } from "@kubernetes/client-node";

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
