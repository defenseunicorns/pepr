// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { it, describe, expect } from "@jest/globals";
import {
  resolveIgnoreNamespaces,
  peprIgnoreNamespaces,
  validateRule,
  generateWebhookRules,
  webhookConfigGenerator,
} from "./webhooks";
import { Event, WebhookType } from "../enums";
import { kind } from "kubernetes-fluent-client";
import { Binding } from "../types";
import { Assets } from "./assets";

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
      "namespaces": ["cicd"]
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

describe("webhookConfigGenerator", () => {
  it("should have correct timeoutSeconds 10", async () => {
    const result = await webhookConfigGenerator(assets, WebhookType.MUTATE);
    expect(result!.webhooks![0].timeoutSeconds).toEqual(10);
  });
  it("should have correct failurePolicy based on assets", async () => {
    const result = await webhookConfigGenerator(assets, WebhookType.VALIDATE);
    expect(result!.webhooks![0].failurePolicy).toEqual("Ignore");
  });
  it("should respect ignoredNamespaces from assets", async () => {
    const result = await webhookConfigGenerator(assets, WebhookType.VALIDATE);
    expect(result!.webhooks![0].namespaceSelector!.matchExpressions![0].values).toEqual([
      "kube-system",
      "pepr-system",
      "cicd",
    ]);
  });
});

describe("validateRule", () => {
  const defaultBinding: Binding = {
    event: Event.CREATE,
    filters: {
      annotations: {},
      deletionTimestamp: false,
      labels: {},
      name: "",
      namespaces: [],
      regexName: "^default$",
      regexNamespaces: [],
    },
    kind: {
      group: "v1",
      kind: "Namespace",
    },
    model: kind.Namespace,
  };

  it("should return undefined if isMutateWebhook is true and isMutate is false", () => {
    const result = validateRule({ ...defaultBinding, isMutate: false }, true);
    expect(result).toBeUndefined();
  });

  it("should return a rule object for a Mutate Binding on a Namespace isCreated", () => {
    const result = validateRule({ ...defaultBinding, isMutate: true }, true);
    expect(result).toEqual({
      apiGroups: ["v1"],
      apiVersions: ["*"],
      operations: ["CREATE"],
      resources: ["namespaces"],
    });
  });

  it("should return a rule object for a Mutate Binding on a Pod isCreated", () => {
    const result = validateRule(
      { ...defaultBinding, isMutate: true, kind: { ...defaultBinding.kind, kind: "Pod" } },
      true,
    );
    expect(result).toEqual({
      apiGroups: ["v1"],
      apiVersions: ["*"],
      operations: ["CREATE"],
      resources: ["pods", "pods/ephemeralcontainers"],
    });
  });

  it("should return undefined if isMutateWebhook is false and isValidate is false", () => {
    const result = validateRule({ ...defaultBinding, isValidate: false, isWatch: true }, false);
    expect(result).toBeUndefined();
  });
});

describe("generateWebhookRules", () => {
  it("should generate a webhook rule for creating Unicorns when the assets have a secret object for mutate on a create event", async () => {
    const result = await generateWebhookRules(assets, true);
    const secretRule = result.filter(rule => rule.resources!.includes("unicorns"));
    expect(secretRule).toEqual([
      { apiGroups: ["pepr.dev"], apiVersions: ["v1"], operations: ["CREATE"], resources: ["unicorns"] },
    ]);
  });
  it("should generate a webhook rule for creating secrets when the assets have a secret object for mutate on a create event", async () => {
    const result = await generateWebhookRules(assets, true);
    const secretRule = result.filter(rule => rule.resources!.includes("secrets"));
    expect(secretRule).toEqual([
      { apiGroups: [""], apiVersions: ["v1"], operations: ["CREATE"], resources: ["secrets"] },
    ]);
  });

  it("should return an empty array if capabilities is empty", async () => {
    assets.capabilities = [];
    const result = await generateWebhookRules(assets, true);
    expect(result).toEqual([]);
  });
});

describe("peprIgnoreNamespaces", () => {
  it("should have order of kube-system, then pepr-system for the helm templating", () => {
    expect(peprIgnoreNamespaces).toEqual(["kube-system", "pepr-system"]);
    expect(peprIgnoreNamespaces[0]).toEqual("kube-system");
    expect(peprIgnoreNamespaces[1]).toEqual("pepr-system");
  });
});

describe("resolveIgnoreNamespaces", () => {
  it("should default to empty array ig config is empty", () => {
    const result = resolveIgnoreNamespaces();
    expect(result).toEqual([]);
  });

  it("should return the config ignore namespaces if not provided PEPR_ADDITIONAL_IGNORED_NAMESPACES is not provided", () => {
    const result = resolveIgnoreNamespaces(["payments", "istio-system"]);
    expect(result).toEqual(["payments", "istio-system"]);
  });

  it("should include additionalIgnoredNamespaces when PEPR_ADDITIONAL_IGNORED_NAMESPACES is provided", () => {
    process.env.PEPR_ADDITIONAL_IGNORED_NAMESPACES = "uds, project-fox";
    const result = resolveIgnoreNamespaces(["zarf", "lula"]);
    expect(result).toEqual(["uds", "project-fox", "zarf", "lula"]);
  });
});
