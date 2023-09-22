// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { packageJSON } from "../../../templates/data.json";
import { fetch } from "../../fetch";
import Log from "../../logger";
import { GenericClass } from "../../types";
import { ClusterRole, Ingress, Pod } from "../upstream";
import { Filters } from "./types";
import { kubeExec, pathBuilder } from "./utils";

jest.mock("https");
jest.mock("../../fetch");

describe("pathBuilder Function", () => {
  const serverUrl = "https://jest-test:8080";
  it("should throw an error if the kind is not specified and the model is not a KubernetesObject", () => {
    const model = { name: "Unknown" } as unknown as GenericClass;
    const filters: Filters = {};
    expect(() => pathBuilder("", model, filters)).toThrow("Kind not specified for Unknown");
  });

  it("should generate a path for core group kinds", () => {
    const filters: Filters = { namespace: "default", name: "mypod" };
    const result = pathBuilder(serverUrl, Pod, filters);
    const expected = new URL("/api/v1/namespaces/default/pods/mypod", serverUrl);
    expect(result).toEqual(expected);
  });

  it("should generate a path for non-core group kinds", () => {
    const filters: Filters = {
      namespace: "default",
      name: "myingress",
    };
    const result = pathBuilder(serverUrl, Ingress, filters);
    const expected = new URL("/apis/networking.k8s.io/v1/namespaces/default/ingresses/myingress", serverUrl);
    expect(result).toEqual(expected);
  });

  it("should generate a path without a namespace if not provided", () => {
    const filters: Filters = { name: "tester" };
    const result = pathBuilder(serverUrl, ClusterRole, filters);
    const expected = new URL("/apis/rbac.authorization.k8s.io/v1/clusterroles/tester", serverUrl);
    expect(result).toEqual(expected);
  });

  it("should generate a path without a name if excludeName is true", () => {
    const filters: Filters = { namespace: "default", name: "mypod" };
    const result = pathBuilder(serverUrl, Pod, filters, true);
    const expected = new URL("/api/v1/namespaces/default/pods", serverUrl);
    expect(result).toEqual(expected);
  });
});

describe("kubeExec Function", () => {
  const mockedFetch = jest.mocked(fetch);
  const mockedLogInfo = jest.mocked(Log.info);

  const fakeFilters: Filters = { name: "fake", namespace: "default" };
  const fakeMethod = "GET";
  const fakePayload = { metadata: { name: "fake", namespace: "default" } };
  const fakeUrl = new URL("http://jest-test:8080/api/v1/namespaces/default/pods/fake");
  const fakeOpts = {
    body: JSON.stringify(fakePayload),
    headers: {
      "Content-Type": "application/json",
      "User-Agent": `pepr.dev/${packageJSON.version}`,
    },
    method: fakeMethod,
  };

  beforeEach(() => {
    mockedFetch.mockClear();
    mockedLogInfo.mockClear();
  });

  it("should make a successful fetch call", async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      data: fakePayload,
      status: 200,
      statusText: "OK",
    });

    const result = await kubeExec(Pod, fakeFilters, fakeMethod, fakePayload);

    expect(result).toEqual(fakePayload);
    expect(mockedFetch).toHaveBeenCalledWith(fakeUrl, expect.objectContaining(fakeOpts));
  });

  it("should handle fetch call failure", async () => {
    const fakeStatus = 404;
    const fakeStatusText = "Not Found";

    mockedFetch.mockResolvedValueOnce({
      ok: false,
      data: null,
      status: fakeStatus,
      statusText: fakeStatusText,
    });

    await expect(kubeExec(Pod, fakeFilters, fakeMethod, fakePayload)).rejects.toEqual(
      expect.objectContaining({
        status: fakeStatus,
        statusText: fakeStatusText,
      }),
    );
  });
});
