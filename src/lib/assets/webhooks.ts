// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import {
  AdmissionregistrationV1WebhookClientConfig as AdmissionRegnV1WebhookClientCfg,
  V1LabelSelectorRequirement,
  V1RuleWithOperations,
  V1MutatingWebhookConfiguration,
  V1ValidatingWebhookConfiguration,
} from "@kubernetes/client-node";
import { kind } from "kubernetes-fluent-client";
import { concat, equals, uniqWith } from "ramda";
import { resolveIgnoreNamespaces } from "./ignoredNamespaces";
import { Assets } from "./assets";
import { Event, WebhookType } from "../enums";
import { Binding, AdditionalWebhook } from "../types";

export const peprIgnoreNamespaces: string[] = ["kube-system", "pepr-system"];

export const validateRule = (
  binding: Binding,
  isMutateWebhook: boolean,
): V1RuleWithOperations | undefined => {
  const { event, kind, isMutate, isValidate } = binding;

  // Skip invalid bindings based on webhook type
  if ((isMutateWebhook && !isMutate) || (!isMutateWebhook && !isValidate)) {
    return undefined;
  }

  // Translate event to operations
  const operations = event === Event.CREATE_OR_UPDATE ? [Event.CREATE, Event.UPDATE] : [event];

  // Use the plural property if it exists, otherwise use lowercase kind + s
  const resource = kind.plural || `${kind.kind.toLowerCase()}s`;

  const ruleObject: V1RuleWithOperations = {
    apiGroups: [kind.group],
    apiVersions: [kind.version || "*"],
    operations,
    resources: [resource, ...(resource === "pods" ? ["pods/ephemeralcontainers"] : [])],
  };

  return ruleObject;
};

export async function generateWebhookRules(
  assets: Assets,
  isMutateWebhook: boolean,
): Promise<V1RuleWithOperations[]> {
  const { capabilities } = assets;

  const rules = capabilities.flatMap(capability =>
    capability.bindings
      .map(binding => validateRule(binding, isMutateWebhook))
      .filter((rule): rule is V1RuleWithOperations => !!rule),
  );

  return uniqWith(equals, rules);
}

export async function webhookConfigGenerator(
  assets: Assets,
  mutateOrValidate: WebhookType,
  timeoutSeconds = 10,
): Promise<kind.MutatingWebhookConfiguration | kind.ValidatingWebhookConfiguration | null> {
  const rules = await generateWebhookRules(assets, mutateOrValidate === WebhookType.MUTATE);
  if (rules.length < 1) {
    return null;
  }

  const baseConfig = makeBaseWebhookConfig(assets, mutateOrValidate, timeoutSeconds, rules);

  // If additional webhooks are specified, add them to the config
  if (assets.config.additionalWebhooks) {
    return configureAdditionalWebhooks(baseConfig, assets.config.additionalWebhooks);
  }

  return baseConfig;
}

export function checkFailurePolicy(failurePolicy: string): void {
  if (failurePolicy !== "Fail" && failurePolicy !== "Ignore") {
    throw new Error(`Invalid failure policy: ${failurePolicy}. Must be either 'Fail' or 'Ignore'.`);
  }
}

export function configureAdditionalWebhooks(
  webhookConfig: V1MutatingWebhookConfiguration | V1ValidatingWebhookConfiguration,
  additionalWebhooks: AdditionalWebhook[],
): V1MutatingWebhookConfiguration | V1ValidatingWebhookConfiguration {
  if (!additionalWebhooks || additionalWebhooks.length === 0) {
    return webhookConfig;
  }
  // set the ignored namespace to the additional webhook namespaces
  const webhooks = webhookConfig.webhooks ?? [];
  if (webhooks.length === 0) {
    return webhookConfig;
  }
  const expr = webhooks[0]!.namespaceSelector!.matchExpressions![0]!;
  expr.values!.push(...additionalWebhooks.map(w => w.namespace));

  additionalWebhooks.forEach(additionalWebhook => {
    checkFailurePolicy(additionalWebhook.failurePolicy);
    webhooks.push({
      name: `${webhookConfig.metadata!.name}-${additionalWebhook.namespace}.pepr.dev`,
      admissionReviewVersions: ["v1", "v1beta1"],
      clientConfig: webhooks[0]!.clientConfig,
      failurePolicy: additionalWebhook.failurePolicy,
      matchPolicy: "Equivalent",
      timeoutSeconds: webhooks[0]!.timeoutSeconds,
      namespaceSelector: {
        matchExpressions: [
          {
            key: "kubernetes.io/metadata.name",
            operator: "In",
            values: [additionalWebhook.namespace],
          },
        ],
      },
      rules: webhooks[0].rules,
      sideEffects: "None",
    });
  });

  return webhookConfig;
}

export function buildClientConfig(
  assets: Assets,
  fullApiPath: string,
): AdmissionRegnV1WebhookClientCfg {
  const { tls, host, name } = assets;
  const clientConfig: AdmissionRegnV1WebhookClientCfg = { caBundle: tls.ca };

  // If a host is specified, use that with a port of 3000
  if (host) {
    clientConfig.url = `https://${host}:3000${fullApiPath}`;
  } else {
    clientConfig.service = {
      name,
      namespace: "pepr-system",
      path: fullApiPath,
    };
  }
  return clientConfig;
}

export function buildNamespaceIgnoreExpressions(assets: Assets): V1LabelSelectorRequirement[] {
  const { config } = assets;

  const resolved =
    resolveIgnoreNamespaces(
      config?.alwaysIgnore?.namespaces?.length
        ? config.alwaysIgnore.namespaces
        : config?.admission?.alwaysIgnore?.namespaces,
    ) ?? [];

  const ignoreValues = concat(peprIgnoreNamespaces, resolved);

  if (ignoreValues.length === 0) return [];

  return [
    {
      key: "kubernetes.io/metadata.name",
      operator: "NotIn",
      values: ignoreValues,
    },
  ];
}

export function makeBaseWebhookConfig(
  assets: Assets,
  mutateOrValidate: WebhookType,
  timeoutSeconds: number,
  rules: V1RuleWithOperations[],
): kind.MutatingWebhookConfiguration | kind.ValidatingWebhookConfiguration {
  const isMutate = mutateOrValidate === WebhookType.MUTATE;
  // The URL must include the API Path
  const fullApiPath = `/${mutateOrValidate}/${assets.apiPath}`;
  const clientConfig = buildClientConfig(assets, fullApiPath);
  const ignoreExpr = buildNamespaceIgnoreExpressions(assets);

  return {
    apiVersion: "admissionregistration.k8s.io/v1",
    kind: isMutate ? "MutatingWebhookConfiguration" : "ValidatingWebhookConfiguration",
    metadata: { name: assets.name },
    webhooks: [
      {
        name: `${assets.name}.pepr.dev`,
        admissionReviewVersions: ["v1", "v1beta1"],
        clientConfig,
        failurePolicy: assets.config.onError === "reject" ? "Fail" : "Ignore",
        matchPolicy: "Equivalent",
        timeoutSeconds,
        namespaceSelector: { matchExpressions: ignoreExpr },
        rules,
        sideEffects: "None",
      },
    ],
  };
}
