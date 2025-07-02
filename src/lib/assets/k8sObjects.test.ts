import { getNamespace, getWatcher, getDeployment, getModuleSecret } from "./k8sObjects";
import { expect, describe, it, vi, afterEach } from "vitest";
import { Assets } from "./assets";
import { gzipSync } from "zlib";
import * as helpers from "../helpers";
import { Binding } from "../types";

vi.mock("zlib");

const assets: Assets = JSON.parse(`{
  "config": {
    "uuid": "static-test",
    "onError": "ignore",
    "webhookTimeout": 10,
    "customLabels": {
      "namespace": {
        "pepr.dev": ""
      }
    },
    "alwaysIgnore": {
      "namespaces": []
    },
    "includedFiles": [],
    "env": {
      "MY_CUSTOM_VAR": "example-value",
      "ZARF_VAR": "###ZARF_VAR_THING###"
    },
    "peprVersion": "0.0.0-development",
    "appVersion": "0.0.1",
    "description": "A test module for Pepr"
  },
  "path": "/Users/cmwylie19/pepr/pepr-test-module/dist/pepr-static-test.js",
  "name": "pepr-static-test",
  "tls": {
    "ca": "",
    "key": "",
    "crt": "",
    "pem": {
      "ca": "",
      "crt": "",
      "key": ""
    }
  },
  "apiPath": "db5eb6d40e3744fcc2d7863c8f56ce24aaa94ff32cf22918700bdb9369e6d426",
  "alwaysIgnore": {
    "namespaces": []
  },
  "capabilities": [
    {
      "name": "hello-pepr",
      "description": "A simple example capability to show how things work.",
      "namespaces": [
        "pepr-demo",
        "pepr-demo-2"
      ],
      "bindings": [
        {
          "kind": {
            "kind": "Namespace",
            "version": "v1",
            "group": ""
          },
          "event": "CREATE",
          "filters": {
            "name": "",
            "namespaces": [],
            "labels": {},
            "annotations": {}
          },
          "isMutate": true
        },
        {
          "kind": {
            "kind": "Namespace",
            "version": "v1",
            "group": ""
          },
          "event": "CREATE",
          "filters": {
            "name": "pepr-demo-2",
            "namespaces": [],
            "labels": {},
            "annotations": {}
          },
          "isWatch": true
        },
        {
          "kind": {
            "kind": "ConfigMap",
            "version": "v1",
            "group": ""
          },
          "event": "CREATE",
          "filters": {
            "name": "example-1",
            "namespaces": [],
            "labels": {},
            "annotations": {}
          },
          "isMutate": true
        },
        {
          "kind": {
            "kind": "ConfigMap",
            "version": "v1",
            "group": ""
          },
          "event": "CREATE",
          "filters": {
            "name": "example-2",
            "namespaces": [],
            "labels": {},
            "annotations": {}
          },
          "isMutate": true
        },
        {
          "kind": {
            "kind": "ConfigMap",
            "version": "v1",
            "group": ""
          },
          "event": "CREATE",
          "filters": {
            "name": "example-2",
            "namespaces": [],
            "labels": {},
            "annotations": {}
          },
          "isValidate": true
        },
        {
          "kind": {
            "kind": "ConfigMap",
            "version": "v1",
            "group": ""
          },
          "event": "CREATE",
          "filters": {
            "name": "example-2",
            "namespaces": [],
            "labels": {},
            "annotations": {}
          },
          "isWatch": true
        },
        {
          "kind": {
            "kind": "ConfigMap",
            "version": "v1",
            "group": ""
          },
          "event": "CREATE",
          "filters": {
            "name": "",
            "namespaces": [],
            "labels": {},
            "annotations": {}
          },
          "isValidate": true
        },
        {
          "kind": {
            "kind": "ConfigMap",
            "version": "v1",
            "group": ""
          },
          "event": "CREATEORUPDATE",
          "filters": {
            "name": "",
            "namespaces": [],
            "labels": {
              "change": "by-label"
            },
            "annotations": {}
          },
          "isMutate": true
        },
        {
          "kind": {
            "kind": "ConfigMap",
            "version": "v1",
            "group": ""
          },
          "event": "DELETE",
          "filters": {
            "name": "",
            "namespaces": [],
            "labels": {
              "change": "by-label"
            },
            "annotations": {}
          },
          "isValidate": true
        },
        {
          "kind": {
            "kind": "ConfigMap",
            "version": "v1",
            "group": ""
          },
          "event": "CREATE",
          "filters": {
            "name": "example-4",
            "namespaces": [],
            "labels": {},
            "annotations": {}
          },
          "isMutate": true
        },
        {
          "kind": {
            "kind": "ConfigMap",
            "version": "v1",
            "group": ""
          },
          "event": "CREATE",
          "filters": {
            "name": "example-4a",
            "namespaces": [
              "pepr-demo-2"
            ],
            "labels": {},
            "annotations": {}
          },
          "isMutate": true
        },
        {
          "kind": {
            "kind": "ConfigMap",
            "version": "v1",
            "group": ""
          },
          "event": "CREATE",
          "filters": {
            "name": "",
            "namespaces": [],
            "labels": {
              "chuck-norris": ""
            },
            "annotations": {}
          },
          "isMutate": true
        },
        {
          "kind": {
            "kind": "Secret",
            "version": "v1",
            "group": ""
          },
          "event": "CREATE",
          "filters": {
            "name": "secret-1",
            "namespaces": [],
            "labels": {},
            "annotations": {}
          },
          "isMutate": true
        },
        {
          "kind": {
            "group": "pepr.dev",
            "version": "v1",
            "kind": "Unicorn"
          },
          "event": "CREATE",
          "filters": {
            "name": "example-1",
            "namespaces": [],
            "labels": {},
            "annotations": {}
          },
          "isMutate": true
        },
        {
          "kind": {
            "group": "pepr.dev",
            "version": "v1",
            "kind": "Unicorn"
          },
          "event": "CREATE",
          "filters": {
            "name": "example-2",
            "namespaces": [],
            "labels": {},
            "annotations": {}
          },
          "isMutate": true
        }
      ],
      "hasSchedule": false
    }
  ],
  "image": "ghcr.io/defenseunicorns/pepr/controller:v0.0.0-development",
  "buildTimestamp": "1721936569867",
  "hash": "e303205079a4445946f6eacde9ec4800534653f85aca6f84539d0f7158a22569"
}`);
describe("namespace function", () => {
  it("should create a namespace object without labels if none are provided", () => {
    const result = getNamespace();
    expect(result).toEqual({
      apiVersion: "v1",
      kind: "Namespace",
      metadata: {
        name: "pepr-system",
      },
    });
    const result1 = getNamespace({ one: "two" });
    expect(result1).toEqual({
      apiVersion: "v1",
      kind: "Namespace",
      metadata: {
        name: "pepr-system",
        labels: {
          one: "two",
        },
      },
    });
  });

  it("should create a namespace object with empty labels if an empty object is provided", () => {
    const result = getNamespace({});
    expect(result.metadata?.labels).toEqual({});
  });

  it("should create a namespace object with provided labels", () => {
    const labels = { "pepr.dev/controller": "admission", "istio-injection": "enabled" };
    const result = getNamespace(labels);
    expect(result.metadata?.labels).toEqual(labels);
  });
});

describe("watcher function", () => {
  it("watcher with bindings", () => {
    const result = getWatcher(assets, "test-hash", "test-timestamp");

    expect(result).toBeTruthy();
    expect(result!.metadata!.name).toBe("pepr-static-test-watcher");
  });

  it("watcher without bindings", () => {
    assets.capabilities = [];
    const result = getWatcher(assets, "test-hash", "test-timestamp");

    expect(result).toBeNull();
  });
});
describe("deployment function", () => {
  it("deployment without bindings should return null", () => {
    const result = getDeployment(assets, "test-hash", "test-timestamp");

    expect(result).toBeNull();
  });
  it("deployment with bindings should return the deployment", () => {
    assets.capabilities = [
      {
        name: "capability-1",
        description: "test",
        namespaces: ["default"],
        bindings: [{ isMutate: true }] as unknown as Binding[],
        hasSchedule: false,
      },
    ];
    const result = getDeployment(assets, "test-hash", "test-timestamp");

    expect(result).toBeTruthy();
    expect(result!.metadata!.name).toBe("pepr-static-test");
  });
});
describe("moduleSecret function", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("moduleSecret within limit", () => {
    const name = "test";
    const data = Buffer.from("test data");
    const hash = "test-hash";
    const compressedData = Buffer.from("compressed data").toString("base64");

    // Mock the return value of gzipSync
    (gzipSync as vi.Mock).mockReturnValue(Buffer.from(compressedData));
    vi.spyOn(helpers, "secretOverLimit").mockReturnValue(false);

    const result = getModuleSecret(name, data, hash);

    expect(result).toEqual({
      apiVersion: "v1",
      kind: "Secret",
      metadata: {
        name: "test-module",
        namespace: "pepr-system",
      },
      type: "Opaque",
      data: {
        [`module-${hash}.js.gz`]: "WTI5dGNISmxjM05sWkNCa1lYUmg=",
      },
    });
  });

  it("moduleSecret over limit", () => {
    const name = "test";
    const data = Buffer.from("test data");
    const hash = "test-hash";

    // Mock the return value of gzipSync
    (gzipSync as vi.Mock).mockReturnValue(data);
    vi.spyOn(helpers, "secretOverLimit").mockReturnValue(true);

    const consoleErrorMock = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => getModuleSecret(name, data, hash)).toThrow(
      "Module secret for test is over the 1MB limit",
    );

    consoleErrorMock.mockRestore();
  });
});
