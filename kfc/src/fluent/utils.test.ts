// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Kubernetes Fluent Client Authors

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Headers } from "node-fetch";

import { fetch } from "../fetch";
import { RegisterKind } from "../kinds";
import { GenericClass } from "../types";
import { ClusterRole, Ingress, Pod } from "../upstream";
import { Filters } from "./types";
import { k8sExec, pathBuilder } from "./utils";

jest.mock("https");
jest.mock("../fetch");

describe("pathBuilder Function", () => {
  const serverUrl = "https://jest-test:8080";
  it("should throw an error if the kind is not specified and the model is not a KubernetesObject", () => {
    const model = { name: "Unknown" } as unknown as GenericClass;
    const filters: Filters = {};
    expect(() => pathBuilder("", model, filters)).toThrow("Kind not specified for Unknown");
  });

  it("should generate a path with a set-based label selector", () => {
    const filters: Filters = {
      namespace: "default",
      name: "mypod",
      labels: { iamalabel: "" },
    };
    const result = pathBuilder(serverUrl, Pod, filters);
    const expected = new URL(
      "/api/v1/namespaces/default/pods/mypod?labelSelector=iamalabel",
      serverUrl,
    );

    expect(result.toString()).toEqual(expected.toString());
  });

  it("should generate a path for core group kinds (with custom filters)", () => {
    const filters: Filters = {
      namespace: "default",
      name: "mypod",
      fields: { iamafield: "iamavalue" },
      labels: { iamalabel: "iamalabelvalue" },
    };
    const result = pathBuilder(serverUrl, Pod, filters);
    const expected = new URL(
      "/api/v1/namespaces/default/pods/mypod?fieldSelector=iamafield%3Diamavalue&labelSelector=iamalabel%3Diamalabelvalue",
      serverUrl,
    );

    expect(result.toString()).toEqual(expected.toString());
  });

  it("Version not specified in a Kind", () => {
    const filters: Filters = {
      namespace: "default",
      name: "mypod",
    };
    class Fake {
      name: string;
      constructor() {
        this.name = "Fake";
      }
    }
    RegisterKind(Fake, {
      kind: "Fake",
      version: "",
      group: "fake",
    });
    try {
      pathBuilder(serverUrl, Fake, filters);
    } catch (e) {
      expect(e.message).toEqual(`Version not specified for Fake`);
    }
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
    const expected = new URL(
      "/apis/networking.k8s.io/v1/namespaces/default/ingresses/myingress",
      serverUrl,
    );
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

  const fakeFilters: Filters = { name: "fake", namespace: "default" };
  const fakeMethod = "GET";
  const fakePayload = {
    metadata: { name: "fake", namespace: "default" },
    status: { phase: "Ready" },
  };
  const fakeUrl = new URL("http://jest-test:8080/api/v1/namespaces/default/pods/fake");
  const fakeOpts = {
    body: JSON.stringify(fakePayload),
    compress: true,
    headers: new Headers({
      "Content-Type": "application/json",
      "User-Agent": `kubernetes-fluent-client`,
    }),
    method: fakeMethod,
  };

  beforeEach(() => {
    mockedFetch.mockClear();
  });

  it("should make a successful fetch call", async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      data: fakePayload,
      status: 200,
      statusText: "OK",
    });

    const result = await k8sExec(Pod, fakeFilters, fakeMethod, fakePayload);

    expect(result).toEqual(fakePayload);
    expect(mockedFetch).toHaveBeenCalledWith(fakeUrl, expect.objectContaining(fakeOpts));
  });

  it("should handle PATCH_STATUS", async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      data: fakePayload,
      status: 200,
      statusText: "OK",
    });

    const result = await k8sExec(Pod, fakeFilters, "PATCH_STATUS", fakePayload);

    expect(result).toEqual(fakePayload);
    expect(mockedFetch).toHaveBeenCalledWith(
      new URL("http://jest-test:8080/api/v1/namespaces/default/pods/fake/status"),
      expect.objectContaining({
        method: "PATCH",
        compress: true,
        headers: new Headers({
          "Content-Type": "application/merge-patch+json",
          "User-Agent": `kubernetes-fluent-client`,
        }),
        body: JSON.stringify({ status: fakePayload.status }),
      }),
    );
  });

  it("should handle PATCH", async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      data: fakePayload,
      status: 200,
      statusText: "OK",
    });

    const patchPayload = [{ op: "replace", path: "/status/phase", value: "Ready" }];

    const result = await k8sExec(Pod, fakeFilters, "PATCH", patchPayload);

    expect(result).toEqual(fakePayload);
    expect(mockedFetch).toHaveBeenCalledWith(
      new URL("http://jest-test:8080/api/v1/namespaces/default/pods/fake"),
      expect.objectContaining({
        method: "PATCH",
        compress: true,
        headers: new Headers({
          "Content-Type": "application/json-patch+json",
          "User-Agent": `kubernetes-fluent-client`,
        }),
        body: JSON.stringify(patchPayload),
      }),
    );
  });

  it("should handle APPLY", async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      data: fakePayload,
      status: 200,
      statusText: "OK",
    });

    const result = await k8sExec(Pod, fakeFilters, "APPLY", fakePayload);

    expect(result).toEqual(fakePayload);
    expect(mockedFetch).toHaveBeenCalledWith(
      new URL(
        "http://jest-test:8080/api/v1/namespaces/default/pods/fake?fieldManager=pepr&fieldValidation=Strict&force=false",
      ),
      expect.objectContaining({
        method: "PATCH",
        compress: true,
        headers: new Headers({
          "Content-Type": "application/apply-patch+yaml",
          "User-Agent": `kubernetes-fluent-client`,
        }),
        body: JSON.stringify(fakePayload),
      }),
    );
  });

  it("should handle APPLY with force", async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      data: fakePayload,
      status: 200,
      statusText: "OK",
    });

    const result = await k8sExec(Pod, fakeFilters, "APPLY", fakePayload, { force: true });

    expect(result).toEqual(fakePayload);
    expect(mockedFetch).toHaveBeenCalledWith(
      new URL(
        "http://jest-test:8080/api/v1/namespaces/default/pods/fake?fieldManager=pepr&fieldValidation=Strict&force=true",
      ),
      expect.objectContaining({
        method: "PATCH",
        compress: true,
        headers: new Headers({
          "Content-Type": "application/apply-patch+yaml",
          "User-Agent": `kubernetes-fluent-client`,
        }),
        body: JSON.stringify(fakePayload),
      }),
    );
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

    await expect(k8sExec(Pod, fakeFilters, fakeMethod, fakePayload)).rejects.toEqual(
      expect.objectContaining({
        status: fakeStatus,
        statusText: fakeStatusText,
      }),
    );
  });
});
