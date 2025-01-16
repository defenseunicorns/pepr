// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { it, describe, expect } from "@jest/globals";
import { createWebhookYaml } from "./index";
import { kind } from "kubernetes-fluent-client";

describe("createWebhookYaml", () => {
  const webhookConfiguration = new kind.MutatingWebhookConfiguration();
  webhookConfiguration.apiVersion = "admissionregistration.k8s.io/v1";
  webhookConfiguration.kind = "MutatingWebhookConfiguration";
  webhookConfiguration.metadata = { name: "pepr-static-test" };
  webhookConfiguration.webhooks = [
    {
      name: "pepr-static-test.pepr.dev",
      admissionReviewVersions: ["v1", "v1beta1"],
      clientConfig: {
        caBundle: "",
        service: {
          name: "pepr-static-test",
          namespace: "pepr-system",
          path: "",
        },
      },
      failurePolicy: "Fail",
      matchPolicy: "Equivalent",
      timeoutSeconds: 15,
      namespaceSelector: {
        matchExpressions: [
          {
            key: "kubernetes.io/metadata.name",
            operator: "NotIn",
            values: ["kube-system", "pepr-system", "something"],
          },
        ],
      },
      sideEffects: "None",
    },
  ];

  const moduleConfig = {
    onError: "reject",
    webhookTimeout: 15,
    uuid: "some-uuid",
    alwaysIgnore: {
      namespaces: ["kube-system", "pepr-system"],
    },
  };

  it("replaces placeholders in the YAML correctly", () => {
    const result = createWebhookYaml("pepr-static-test", moduleConfig, webhookConfiguration);
    expect(result).toContain("{{ .Values.uuid }}");
    expect(result).toContain("{{ .Values.admission.failurePolicy }}");
    expect(result).toContain("{{ .Values.admission.webhookTimeout }}");
    expect(result).toContain("- pepr-system");
    expect(result).toContain("- kube-system");
    expect(result).toContain("{{- range .Values.additionalIgnoredNamespaces }}");
    expect(result).toContain("{{ . }}");
    expect(result).toContain("{{- end }}");
  });
});
