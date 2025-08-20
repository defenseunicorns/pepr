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
  const ignore: V1LabelSelectorRequirement[] = [];

  const { name, tls, config, apiPath, host } = assets;
  const ignoreNS = concat(
    peprIgnoreNamespaces,
    resolveIgnoreNamespaces(
      config?.alwaysIgnore?.namespaces?.length
        ? config?.alwaysIgnore?.namespaces
        : config?.admission?.alwaysIgnore?.namespaces,
    ),
  );

  // Add any namespaces to ignore
  if (ignoreNS) {
    ignore.push({
      key: "kubernetes.io/metadata.name",
      operator: "NotIn",
      values: ignoreNS,
    });
  }

  const clientConfig: AdmissionRegnV1WebhookClientCfg = {
    caBundle: tls.ca,
  };

  // The URL must include the API Path
  const fullApiPath = `/${mutateOrValidate}/${apiPath}`;

  // If a host is specified, use that with a port of 3000
  if (host) {
    clientConfig.url = `https://${host}:3000${fullApiPath}`;
  } else {
    // Otherwise, use the service
    clientConfig.service = {
      name: name,
      namespace: "pepr-system",
      path: fullApiPath,
    };
  }

  const isMutate = mutateOrValidate === WebhookType.MUTATE;
  const rules = await generateWebhookRules(assets, isMutate);

  // If there are no rules, return null
  if (rules.length < 1) {
    return null;
  }

  const webhookConfig = {
    apiVersion: "admissionregistration.k8s.io/v1",
    kind: isMutate ? "MutatingWebhookConfiguration" : "ValidatingWebhookConfiguration",
    metadata: { name },
    webhooks: [
      {
        name: `${name}.pepr.dev`,
        admissionReviewVersions: ["v1", "v1beta1"],
        clientConfig,
        failurePolicy: config.onError === "reject" ? "Fail" : "Ignore",
        matchPolicy: "Equivalent",
        timeoutSeconds,
        namespaceSelector: {
          matchExpressions: ignore,
        },
        rules,
        // @todo: track side effects state
        sideEffects: "None",
      },
    ],
  };

  // If additional webhooks are specified, add them to the config
  if (config.additionalWebhooks) {
    return configureAdditionalWebhooks(webhookConfig, config.additionalWebhooks);
  }

  return webhookConfig;
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
