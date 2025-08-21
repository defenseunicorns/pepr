// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { it, describe, expect, beforeEach, vi } from "vitest";
import {
  peprIgnoreNamespaces,
  validateRule,
  generateWebhookRules,
  webhookConfigGenerator,
  configureAdditionalWebhooks,
  checkFailurePolicy,
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

vi.mock("../telemetry/logger", () => ({
  default: {
    info: vi.fn(),
  },
}));

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

const loseAssets: LooseAssets = createTestAssets();
const assets: Assets = new Assets(
  loseAssets.config as ModuleConfig,
  loseAssets.path,
  loseAssets.imagePullSecrets,
);

assets.capabilities = [...loseAssets.capabilities];

describe("Webhook Management", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("when generating a webhook", () => {
    it("should set timeoutSeconds to 10", async () => {
      const result = await webhookConfigGenerator(assets, WebhookType.MUTATE);
      expect(result!.webhooks![0].timeoutSeconds).toEqual(10);
    });
    it("should set failurePolicy based on module config", async () => {
      const result = await webhookConfigGenerator(assets, WebhookType.VALIDATE);
      expect(result!.webhooks![0].failurePolicy).toEqual("Ignore");
    });

    it("should include ignoredNamespaces from assets in namespace selector", async () => {
      const result = await webhookConfigGenerator(assets, WebhookType.VALIDATE);
      expect(result!.webhooks![0].namespaceSelector!.matchExpressions![0].values).toEqual([
        "kube-system",
        "pepr-system",
        "cicd",
      ]);
    });

    describe("when a host is specified", () => {
      it("should use that host in webhook URL", async () => {
        const assetsWithHost = new Assets(
          assets.config,
          assets.path,
          assets.imagePullSecrets,
          "localhost",
        );
        assetsWithHost.capabilities = assets.capabilities;
        const apiPathPattern = "[a-fA-F0-9]{32}";
        const expected = new RegExp(`https:\\/\\/localhost:3000\\/validate\\/${apiPathPattern}`);

        const result = await webhookConfigGenerator(assetsWithHost, WebhookType.VALIDATE);

        expect(result!.webhooks![0].clientConfig.url).toMatch(expected);
      });
    });
  });
  describe("when validating rules", () => {
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

    describe("when isMutateWebhook is true but binding is not for mutation", () => {
      it("should return undefined", () => {
        const result = validateRule({ ...defaultBinding, isMutate: false }, true);
        expect(result).toBeUndefined();
      });
    });

    describe("when processing a mutation binding for namespace creation", () => {
      it("should return a rule object", () => {
        const result = validateRule({ ...defaultBinding, isMutate: true }, true);
        expect(result).toEqual({
          apiGroups: ["v1"],
          apiVersions: ["*"],
          operations: ["CREATE"],
          resources: ["namespaces"],
        });
      });
    });

    describe("when processing a pod creation mutation", () => {
      it("should return a rule object with ephemeralcontainers", () => {
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
    });

    describe("when isMutateWebhook is false and isValidate is false", () => {
      it("should return undefined", () => {
        const result = validateRule({ ...defaultBinding, isValidate: false, isWatch: true }, false);
        expect(result).toBeUndefined();
      });
    });
  });

  describe("when generating webhook rules", () => {
    describe("when assets contain bindings for custom resources", () => {
      it("should generate a webhook rule for custom resources", async () => {
        const result = await generateWebhookRules(assets, true);
        const secretRule = result.filter(rule => rule.resources!.includes("unicorns"));
        expect(secretRule).toEqual([
          {
            apiGroups: ["pepr.dev"],
            apiVersions: ["v1"],
            operations: ["CREATE"],
            resources: ["unicorns"],
          },
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

    describe("when no capabilities exist", () => {
      it("should return an empty array", async () => {
        assets.capabilities = [];
        const result = await generateWebhookRules(assets, true);
        expect(result).toEqual([]);
      });
    });
  });

  describe("peprIgnoreNamespaces constant", () => {
    it("should contain system namespaces in the correct order for helm templating", () => {
      expect(peprIgnoreNamespaces).toEqual(["kube-system", "pepr-system"]);
      expect(peprIgnoreNamespaces[0]).toEqual("kube-system");
      expect(peprIgnoreNamespaces[1]).toEqual("pepr-system");
    });
  });
});

describe("configureAdditionalWebhooks", () => {
  it("should return the original webhookConfig if no additionalWebhooks are provided", () => {
    const webhookConfig: kind.MutatingWebhookConfiguration = {
      apiVersion: "admissionregistration.k8s.io/v1",
      kind: "MutatingWebhookConfiguration",
      metadata: { name: "test-webhook" },
      webhooks: [],
    };
    const result = configureAdditionalWebhooks(webhookConfig, []);
    expect(result).toEqual(webhookConfig);
  });

  it("should set the additionalWebhooks namespaces in the namespaceSelector of the first webhook to ignore it", () => {
    const webhookConfig: kind.MutatingWebhookConfiguration = {
      apiVersion: "admissionregistration.k8s.io/v1",
      kind: "MutatingWebhookConfiguration",
      metadata: { name: "test-webhook" },
      webhooks: [
        {
          name: "test-webhook.default.pepr.dev",
          admissionReviewVersions: ["v1"],
          clientConfig: { url: "https://example.com/webhook" },
          failurePolicy: "Ignore",
          matchPolicy: "Equivalent",
          timeoutSeconds: 10,
          namespaceSelector: {
            matchExpressions: [{ key: "kubernetes.io/metadata.name", operator: "In", values: [] }],
          },
          rules: [],
          sideEffects: "None",
        },
      ],
    };
    const additionalWebhooks = [
      { failurePolicy: "Fail", namespace: "additional-namespace-1" },
      { failurePolicy: "Ignore", namespace: "additional-namespace-2" },
    ];
    const result = configureAdditionalWebhooks(webhookConfig, additionalWebhooks);

    expect(result.webhooks![0].namespaceSelector!.matchExpressions![0].values).toContain(
      "additional-namespace-1",
    );
    expect(result.webhooks![0].namespaceSelector!.matchExpressions![0].values).toContain(
      "additional-namespace-2",
    );
  });

  it("should add additional webhooks to the webhook config", () => {
    const webhookConfig: kind.MutatingWebhookConfiguration = {
      apiVersion: "admissionregistration.k8s.io/v1",
      kind: "MutatingWebhookConfiguration",
      metadata: { name: "test-webhook" },
      webhooks: [
        {
          name: "test-webhook.default.pepr.dev",
          admissionReviewVersions: ["v1"],
          clientConfig: { url: "https://example.com/webhook" },
          failurePolicy: "Ignore",
          matchPolicy: "Equivalent",
          timeoutSeconds: 10,
          namespaceSelector: {
            matchExpressions: [{ key: "kubernetes.io/metadata.name", operator: "In", values: [] }],
          },
          rules: [],
          sideEffects: "None",
        },
      ],
    };
    const additionalWebhooks = [
      { failurePolicy: "Fail", namespace: "additional-namespace-1" },
      { failurePolicy: "Ignore", namespace: "additional-namespace-2" },
    ];
    const result = configureAdditionalWebhooks(webhookConfig, additionalWebhooks);

    expect(result.webhooks!.length).toBe(3);
    expect(result.webhooks![1].name).toBe("test-webhook-additional-namespace-1.pepr.dev");
    expect(result.webhooks![2].name).toBe("test-webhook-additional-namespace-2.pepr.dev");
    expect(result.webhooks![1].namespaceSelector!.matchExpressions![0].values).toContain(
      "additional-namespace-1",
    );
    expect(result.webhooks![2].namespaceSelector!.matchExpressions![0].values).toContain(
      "additional-namespace-2",
    );
    expect(result.webhooks![1].failurePolicy).toBe("Fail");
    expect(result.webhooks![2].failurePolicy).toBe("Ignore");
  });
});

describe("checkFailurePolicy", () => {
  it("should throw an error for invalid failure policies", () => {
    expect(() => checkFailurePolicy("InvalidPolicy")).toThrowError(
      "Invalid failure policy: InvalidPolicy. Must be either 'Fail' or 'Ignore'.",
    );
  });

  it("should return the failure policy for valid policies", () => {
    expect(checkFailurePolicy("Fail")).not.toThrowError();
    expect(checkFailurePolicy("Ignore")).not.toThrowError();
  });
});
