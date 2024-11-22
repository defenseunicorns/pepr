// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import {
  AdmissionregistrationV1WebhookClientConfig as AdmissionRegnV1WebhookClientCfg,
  V1LabelSelectorRequirement,
  V1RuleWithOperations,
} from "@kubernetes/client-node";
import { kind } from "kubernetes-fluent-client";
import { concat, equals, uniqWith } from "ramda";

import { Assets } from ".";
import { Event } from "../enums";

const peprIgnoreLabel: V1LabelSelectorRequirement = {
  key: "pepr.dev",
  operator: "NotIn",
  values: ["ignore"],
};

const peprIgnoreNamespaces: string[] = ["kube-system", "pepr-system"];

export async function generateWebhookRules(assets: Assets, isMutateWebhook: boolean) {
  const { config, capabilities } = assets;
  const rules: V1RuleWithOperations[] = [];

  // Iterate through the capabilities and generate the rules
  for (const capability of capabilities) {
    console.info(`Module ${config.uuid} has capability: ${capability.name}`);

    // Read the bindings and generate the rules
    for (const binding of capability.bindings) {
      const { event, kind, isMutate, isValidate } = binding;

      // If the module doesn't have a callback for the event, skip it
      if (isMutateWebhook && !isMutate) {
        continue;
      }

      if (!isMutateWebhook && !isValidate) {
        continue;
      }

      const operations: string[] = [];

      // CreateOrUpdate is a Pepr-specific event that is translated to Create and Update
      if (event === Event.CREATE_OR_UPDATE) {
        operations.push(Event.CREATE, Event.UPDATE);
      } else {
        operations.push(event);
      }

      // Use the plural property if it exists, otherwise use lowercase kind + s
      const resource = kind.plural || `${kind.kind.toLowerCase()}s`;

      const ruleObject = {
        apiGroups: [kind.group],
        apiVersions: [kind.version || "*"],
        operations,
        resources: [resource],
      };

      // If the resource is pods, add ephemeralcontainers as well
      if (resource === "pods") {
        ruleObject.resources.push("pods/ephemeralcontainers");
      }

      // Add the rule to the rules array
      rules.push(ruleObject);
    }
  }

  // Return the rules with duplicates removed
  return uniqWith(equals, rules);
}

export async function webhookConfig(
  assets: Assets,
  mutateOrValidate: "mutate" | "validate",
  timeoutSeconds = 10,
): Promise<kind.MutatingWebhookConfiguration | kind.ValidatingWebhookConfiguration | null> {
  const ignore = [peprIgnoreLabel];

  const { name, tls, config, apiToken, host } = assets;
  const ignoreNS = concat(peprIgnoreNamespaces, config?.alwaysIgnore?.namespaces || []);

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
        objectSelector: {
          matchExpressions: ignore,
        },
        rules,
        // @todo: track side effects state
        sideEffects: "None",
      },
    ],
  };
}
