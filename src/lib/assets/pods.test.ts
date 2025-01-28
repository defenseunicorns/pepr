import { getNamespace, getWatcher, getDeployment, getModuleSecret, genEnv } from "./pods";
import { expect, describe, test, jest, afterEach } from "@jest/globals";
import { Assets } from "./assets";
import { ModuleConfig } from "../core/module";
import { gzipSync } from "zlib";

jest.mock("zlib");

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
  "apiToken": "db5eb6d40e3744fcc2d7863c8f56ce24aaa94ff32cf22918700bdb9369e6d426",
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
  test("should create a namespace object without labels if none are provided", () => {
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

  test("should create a namespace object with empty labels if an empty object is provided", () => {
    const result = getNamespace({});
    expect(result.metadata?.labels).toEqual({});
  });

  test("should create a namespace object with provided labels", () => {
    const labels = { "pepr.dev/controller": "admission", "istio-injection": "enabled" };
    const result = getNamespace(labels);
    expect(result.metadata?.labels).toEqual(labels);
  });
});

describe("watcher function", () => {
  test("watcher with bindings", () => {
    const result = getWatcher(assets, "test-hash", "test-timestamp");

    expect(result).toBeTruthy();
    expect(result!.metadata!.name).toBe("pepr-static-test-watcher");
  });

  test("watcher without bindings", () => {
    assets.capabilities = [];
    const result = getWatcher(assets, "test-hash", "test-timestamp");

    expect(result).toBeNull();
  });
});
describe("deployment function", () => {
  test("deployment", () => {
    const result = getDeployment(assets, "test-hash", "test-timestamp");

    expect(result).toBeTruthy();
    expect(result!.metadata!.name).toBe("pepr-static-test");
  });
});
describe("moduleSecret function", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  test("moduleSecret within limit", () => {
    const name = "test";
    const data = Buffer.from("test data");
    const hash = "test-hash";
    const compressedData = Buffer.from("compressed data").toString("base64");

    // Mock the return value of gzipSync
    (gzipSync as jest.Mock).mockReturnValue(Buffer.from(compressedData));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    jest.spyOn(require("../helpers"), "secretOverLimit").mockReturnValue(false);

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

  test("moduleSecret over limit", () => {
    const name = "test";
    const data = Buffer.from("test data");
    const hash = "test-hash";

    // Mock the return value of gzipSync
    (gzipSync as jest.Mock).mockReturnValue(data);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    jest.spyOn(require("../helpers"), "secretOverLimit").mockReturnValue(true);

    const consoleErrorMock = jest.spyOn(console, "error").mockImplementation(() => {});
    const processExitMock = jest.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    expect(() => getModuleSecret(name, data, hash)).toThrow("process.exit");

    expect(consoleErrorMock).toHaveBeenCalledWith(
      "Uncaught Exception:",
      new Error(`Module secret for ${name} is over the 1MB limit`),
    );

    consoleErrorMock.mockRestore();
    processExitMock.mockRestore();
  });
});

describe("genEnv", () => {
  test("generates default environment variables without watch mode", () => {
    const config: ModuleConfig = {
      uuid: "12345",
      alwaysIgnore: {
        namespaces: [],
      },
      customLabels: {
        namespace: {
          "pepr.dev": "",
        },
      },
    };

    const expectedEnv = [
      { name: "PEPR_WATCH_MODE", value: "false" },
      { name: "PEPR_PRETTY_LOG", value: "false" },
      { name: "LOG_LEVEL", value: "info" },
    ];

    const result = genEnv(config);

    expect(result).toEqual(expectedEnv);
  });

  test("generates default environment variables with watch mode", () => {
    const config: ModuleConfig = {
      uuid: "12345",
      alwaysIgnore: {
        namespaces: [],
      },
      customLabels: {
        namespace: {
          "pepr.dev": "",
        },
      },
    };

    const expectedEnv = [
      { name: "PEPR_WATCH_MODE", value: "true" },
      { name: "PEPR_PRETTY_LOG", value: "false" },
      { name: "LOG_LEVEL", value: "info" },
    ];

    const result = genEnv(config, true);

    expect(result).toEqual(expectedEnv);
  });

  test("overrides default environment variables with config.env", () => {
    const config: ModuleConfig = {
      uuid: "12345",
      logLevel: "debug",
      env: {
        CUSTOM_ENV_VAR: "custom_value",
      },
      alwaysIgnore: {
        namespaces: [],
      },
      customLabels: {
        namespace: {
          "pepr.dev": "",
        },
      },
    };

    const expectedEnv = [
      { name: "PEPR_WATCH_MODE", value: "false" },
      { name: "PEPR_PRETTY_LOG", value: "false" },
      { name: "LOG_LEVEL", value: "debug" },
      { name: "CUSTOM_ENV_VAR", value: "custom_value" },
    ];

    const result = genEnv(config);

    expect(result).toEqual(expectedEnv);
  });

  test("handles empty config.env correctly", () => {
    const config: ModuleConfig = {
      uuid: "12345",
      logLevel: "error",
      env: {},
      alwaysIgnore: {
        namespaces: [],
      },
      customLabels: {
        namespace: {
          "pepr.dev": "",
        },
      },
    };

    const expectedEnv = [
      { name: "PEPR_WATCH_MODE", value: "false" },
      { name: "PEPR_PRETTY_LOG", value: "false" },
      { name: "LOG_LEVEL", value: "error" },
    ];

    const result = genEnv(config);

    expect(result).toEqual(expectedEnv);
  });

  test("should not be able to override PEPR_WATCH_MODE in package.json pepr env", () => {
    const config: ModuleConfig = {
      uuid: "12345",
      logLevel: "error",
      env: {
        PEPR_WATCH_MODE: "false",
      },
      alwaysIgnore: {
        namespaces: [],
      },
      customLabels: {
        namespace: {
          "pepr.dev": "",
        },
      },
    };

    const result = genEnv(config, true);
    const watchMode = result.filter(env => env.name === "PEPR_WATCH_MODE")[0];
    expect(watchMode.value).toEqual("true");
  });

  test("handles no config.env correctly", () => {
    const config: ModuleConfig = {
      uuid: "12345",
      logLevel: "error",
      alwaysIgnore: {
        namespaces: [],
      },
      customLabels: {
        namespace: {
          "pepr.dev": "",
        },
      },
    };

    const expectedEnv = [
      { name: "PEPR_WATCH_MODE", value: "false" },
      { name: "PEPR_PRETTY_LOG", value: "false" },
      { name: "LOG_LEVEL", value: "error" },
    ];

    const result = genEnv(config);

    expect(result).toEqual(expectedEnv);
  });

  test("handles ignoreWatchMode for helm chart", () => {
    const config: ModuleConfig = {
      uuid: "12345",
      logLevel: "error",
      alwaysIgnore: {
        namespaces: [],
      },
      customLabels: {
        namespace: {
          "pepr.dev": "",
        },
      },
    };

    const expectedEnv = [
      { name: "PEPR_PRETTY_LOG", value: "false" },
      { name: "LOG_LEVEL", value: "error" },
    ];

    const result = genEnv(config, false, true);

    expect(result).toEqual(expectedEnv);
  });
});
