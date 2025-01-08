// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import {
  AdmissionregistrationV1WebhookClientConfig as AdmissionRegnV1WebhookClientCfg,
  V1LabelSelectorRequirement,
  V1RuleWithOperations,
} from "@kubernetes/client-node";
import { kind } from "kubernetes-fluent-client";
import { concat, equals, uniqWith } from "ramda";

import { Assets } from "./assets";
import { Event } from "../enums";
import { Binding } from "../types";

// Order matters for helm template - must be kube-system, then pepr-system
const peprIgnoreNamespaces: string[] = ["kube-system", "pepr-system"];

const validateRule = (binding: Binding, isMutateWebhook: boolean): V1RuleWithOperations | undefined => {
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

export function resolveIgnoreNamespaces(ignoredNSConfig: string[] = []): string[] {
  const ignoredNSEnv = process.env.PEPR_ADDITIONAL_IGNORED_NAMESPACES;
  if (!ignoredNSEnv) {
    return ignoredNSConfig;
  }

  const namespaces = ignoredNSEnv.split(",").map(ns => ns.trim());

  // add alwaysIgnore.namespaces to the list
  if (ignoredNSConfig) {
    namespaces.push(...ignoredNSConfig);
  }
  return namespaces.filter(ns => ns.length > 0);
}

export async function generateWebhookRules(assets: Assets, isMutateWebhook: boolean): Promise<V1RuleWithOperations[]> {
  const { config, capabilities } = assets;

  const rules = capabilities.flatMap(capability => {
    console.info(`Module ${config.uuid} has capability: ${capability.name}`);

    return capability.bindings
      .map(binding => validateRule(binding, isMutateWebhook))
      .filter((rule): rule is V1RuleWithOperations => !!rule);
  });

  return uniqWith(equals, rules);
}

export async function webhookConfig(
  assets: Assets,
  mutateOrValidate: "mutate" | "validate",
  timeoutSeconds = 10,
): Promise<kind.MutatingWebhookConfiguration | kind.ValidatingWebhookConfiguration | null> {
  const ignore: V1LabelSelectorRequirement[] = [];

  const { name, tls, config, apiToken, host } = assets;
  const ignoreNS = concat(peprIgnoreNamespaces, resolveIgnoreNamespaces(config?.alwaysIgnore?.namespaces));

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

  // The URL must include the API Token
  const apiPath = `/${mutateOrValidate}/${apiToken}`;

  // If a host is specified, use that with a port of 3000
  if (host) {
    clientConfig.url = `https://${host}:3000${apiPath}`;
  } else {
    // Otherwise, use the service
    clientConfig.service = {
      name: name,
      namespace: "pepr-system",
      path: apiPath,
    };
  }

  const isMutate = mutateOrValidate === "mutate";
  const rules = await generateWebhookRules(assets, isMutate);

  // If there are no rules, return null
  if (rules.length < 1) {
    return null;
  }

  return {
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
}
