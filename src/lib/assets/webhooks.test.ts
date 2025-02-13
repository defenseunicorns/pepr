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
import { Binding, CapabilityExport, ModuleConfig } from "../types";
import { WebhookIgnore } from "../k8s";
import { TLSOut } from "../tls";
import { Assets } from "./assets";

export type AssetsType = {
  name: string;
  apiPath: string;
  tls: TLSOut;
  config: ModuleConfig;
  path: string;
  alwaysIgnore: WebhookIgnore;
  imagePullSecrets: string[];
  capabilities: CapabilityExport[];
  image: string;
  buildTimestamp: string;
  host?: string;
};

type LooseBinding = Omit<Binding, "filters" | "model"> & {
  filters?: Partial<Binding["filters"]>;
  model?: Partial<Binding["model"]>;
};

type LooseAssets = Omit<AssetsType, "config" | "deploy"> & {
  config?: AssetsType["config"] & { includedFiles?: string[] };
  hash: string;
};

const allBindings: LooseBinding[] = [
  {
    kind: { kind: "Namespace", version: "v1", group: "" },
    event: Event.CREATE,
    filters: { name: "", namespaces: [], labels: {}, annotations: {} },
    isMutate: true,
  },
  {
    kind: { kind: "Namespace", version: "v1", group: "" },
    event: Event.CREATE,
    filters: {
      name: "pepr-demo-2",
      namespaces: [],
      labels: {},
      annotations: {},
    },
    isWatch: true,
  },
  {
    kind: { kind: "ConfigMap", version: "v1", group: "" },
    event: Event.CREATE,
    filters: { name: "example-1", namespaces: [], labels: {}, annotations: {} },
    isMutate: true,
  },
  {
    kind: { kind: "ConfigMap", version: "v1", group: "" },
    event: Event.CREATE,
    filters: { name: "example-2", namespaces: [], labels: {}, annotations: {} },
    isMutate: true,
  },
  {
    kind: { kind: "ConfigMap", version: "v1", group: "" },
    event: Event.CREATE,
    filters: { name: "example-2", namespaces: [], labels: {}, annotations: {} },
    isValidate: true,
  },
  {
    kind: { kind: "ConfigMap", version: "v1", group: "" },
    event: Event.CREATE,
    filters: { name: "example-2", namespaces: [], labels: {}, annotations: {} },
    isWatch: true,
  },
  {
    kind: { kind: "ConfigMap", version: "v1", group: "" },
    event: Event.CREATE,
    filters: { name: "", namespaces: [], labels: {}, annotations: {} },
    isValidate: true,
  },
  {
    kind: { kind: "ConfigMap", version: "v1", group: "" },
    event: Event.CREATE_OR_UPDATE,
    filters: {
      name: "",
      namespaces: [],
      labels: { change: "by-label" },
      annotations: {},
    },
    isMutate: true,
  },
  {
    kind: { kind: "ConfigMap", version: "v1", group: "" },
    event: Event.DELETE,
    filters: {
      name: "",
      namespaces: [],
      labels: { change: "by-label" },
      annotations: {},
    },
    isValidate: true,
  },
  {
    kind: { kind: "ConfigMap", version: "v1", group: "" },
    event: Event.CREATE,
    filters: { name: "example-4", namespaces: [], labels: {}, annotations: {} },
    isMutate: true,
  },
  {
    kind: { kind: "ConfigMap", version: "v1", group: "" },
    event: Event.CREATE,
    filters: {
      name: "example-4a",
      namespaces: ["pepr-demo-2"],
      labels: {},
      annotations: {},
    },
    isMutate: true,
  },
  {
    kind: { kind: "ConfigMap", version: "v1", group: "" },
    event: Event.CREATE,
    filters: {
      name: "",
      namespaces: [],
      labels: { "chuck-norris": "" },
      annotations: {},
    },
    isMutate: true,
  },
  {
    kind: { kind: "Secret", version: "v1", group: "" },
    event: Event.CREATE,
    filters: { name: "secret-1", namespaces: [], labels: {}, annotations: {} },
    isMutate: true,
  },
  {
    kind: { group: "pepr.dev", version: "v1", kind: "Unicorn" },
    event: Event.CREATE,
    filters: { name: "example-1", namespaces: [], labels: {}, annotations: {} },
    isMutate: true,
  },
  {
    kind: { group: "pepr.dev", version: "v1", kind: "Unicorn" },
    event: Event.CREATE,
    filters: { name: "example-2", namespaces: [], labels: {}, annotations: {} },
    isMutate: true,
  },
];

// Factory function to generate test assets
const createTestAssets = (overrides?: Partial<AssetsType>): LooseAssets => {
  return {
    config: {
      uuid: "static-test",
      onError: "ignore",
      webhookTimeout: 10,
      customLabels: { namespace: { "pepr.dev": "" } },
      alwaysIgnore: { namespaces: ["cicd"] },
      includedFiles: [],
      env: {
        MY_CUSTOM_VAR: "example-value",
        ZARF_VAR: "###ZARF_VAR_THING###",
      },
      peprVersion: "0.0.0-development",
      appVersion: "0.0.1",
      description: "A test module for Pepr",
    },
    path: "/Users/cmwylie19/pepr/pepr-test-module/dist/pepr-static-test.js",
    name: "pepr-static-test",
    tls: {
      ca: "",
      key: "",
      crt: "",
      pem: { ca: "", crt: "", key: "" },
    },
    apiPath: "db5eb6d40e3744fcc2d7863c8f56ce24aaa94ff32cf22918700bdb9369e6d426",
    alwaysIgnore: { namespaces: [] },
    capabilities: [
      {
        name: "hello-pepr",
        description: "A simple example capability to show how things work.",
        namespaces: ["pepr-demo", "pepr-demo-2"],
        bindings: allBindings as Binding[],
        hasSchedule: false,
      },
    ],
    image: "ghcr.io/defenseunicorns/pepr/controller:v0.0.0-development",
    buildTimestamp: Date.now().toString(),
    hash: "e303205079a4445946f6eacde9ec4800534653f85aca6f84539d0f7158a22569",
    // not sure where it comes from - temporarily adding it to avoid type error
    imagePullSecrets: [""],
    ...overrides,
  };
};

const assets: AssetsType = createTestAssets() as AssetsType;

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
  it("should use a specified host", async () => {
    const assetsWithHost = new Assets(assets.config, assets.path, assets.imagePullSecrets, "localhost");
    assetsWithHost.capabilities = assets.capabilities;
    const apiPathPattern = "[a-fA-F0-9]{32}";
    const expected = new RegExp(`https:\\/\\/localhost:3000\\/validate\\/${apiPathPattern}`);

    const result = await webhookConfigGenerator(assetsWithHost, WebhookType.VALIDATE);

    expect(result!.webhooks![0].clientConfig.url).toMatch(expected);
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
  describe("when the assets have a secret object for mutate on a create event", () => {
    it("should generate a webhook rule for creating Unicorns", async () => {
      const result = await generateWebhookRules(assets, true);
      const secretRule = result.filter(rule => rule.resources!.includes("unicorns"));
      expect(secretRule).toEqual([
        { apiGroups: ["pepr.dev"], apiVersions: ["v1"], operations: ["CREATE"], resources: ["unicorns"] },
      ]);
    });
    it("should generate a webhook rule for creating secrets", async () => {
      const result = await generateWebhookRules(assets, true);
      const secretRule = result.filter(rule => rule.resources!.includes("secrets"));
      expect(secretRule).toEqual([
        { apiGroups: [""], apiVersions: ["v1"], operations: ["CREATE"], resources: ["secrets"] },
      ]);
    });
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
  it("should default to empty array if config is empty", () => {
    const result = resolveIgnoreNamespaces();
    expect(result).toEqual([]);
  });
  it("should return the config ignore namespaces", () => {
    const result = resolveIgnoreNamespaces(["payments", "istio-system"]);
    expect(result).toEqual(["payments", "istio-system"]);
  });
  describe("when PEPR_ADDITIONAL_IGNORED_NAMESPACES are provided", () => {
    it("should include additionalIgnoredNamespaces", () => {
      process.env.PEPR_ADDITIONAL_IGNORED_NAMESPACES = "uds, project-fox";
      const result = resolveIgnoreNamespaces(["zarf", "lula"]);
      expect(result).toEqual(["uds", "project-fox", "zarf", "lula"]);
    });
  });
});
