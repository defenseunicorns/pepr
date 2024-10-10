// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import {
  nsTemplate,
  chartYaml,
  watcherDeployTemplate,
  admissionDeployTemplate,
  serviceMonitorTemplate,
  roleBindingTemplate,
  clusterRoleBindingTemplate,
  roleTemplate,
  RoleRule,
  clusterRoleTemplate,
  ClusterRoleRule,
} from "./helm";
import { expect, describe, test } from "@jest/globals";
describe("Kubernetes Template Generators", () => {
  describe("nsTemplate", () => {
    test("should generate a Namespace template correctly", () => {
      const result = nsTemplate();
      expect(result).toContain("apiVersion: v1");
      expect(result).toContain("kind: Namespace");
      expect(result).toContain("name: pepr-system");
    });
  });

  describe("chartYaml", () => {
    test("should generate a Chart.yaml content correctly", () => {
      const name = "test-app";
      const description = "A test application";
      const result = chartYaml(name, description);
      expect(result).toContain("apiVersion: v2");
      expect(result).toContain(`name: ${name}`);
      expect(result).toContain(`description: ${description}`);
    });
  });

  describe("watcherDeployTemplate", () => {
    test("should generate a Deployment template for the watcher correctly", () => {
      const result = watcherDeployTemplate(`${Date.now()}`);
      expect(result).toContain("apiVersion: apps/v1");
      expect(result).toContain("kind: Deployment");
      expect(result).toContain("name: {{ .Values.uuid }}-watcher");
    });
  });

  describe("admissionDeployTemplate", () => {
    test("should generate a Deployment template for the admission controller correctly", () => {
      const result = admissionDeployTemplate(`${Date.now()}`);
      expect(result).toContain("apiVersion: apps/v1");
      expect(result).toContain("kind: Deployment");
      expect(result).toContain("name: {{ .Values.uuid }}");
    });
  });

  describe("admissionServiceMonitor", () => {
    test("should generate a Service Monitor template for the admission controller correctly", () => {
      const result = serviceMonitorTemplate("admission");
      expect(result).toContain("apiVersion: monitoring.coreos.com/v1");
      expect(result).toContain("kind: ServiceMonitor");
      expect(result).toContain("name: admission");
      expect(result).toContain("pepr.dev/controller: admission");
    });
  });

  describe("watcherServiceMonitor", () => {
    test("should generate a Service Monitor template for the watcher controller correctly", () => {
      const result = serviceMonitorTemplate("watcher");
      expect(result).toContain("apiVersion: monitoring.coreos.com/v1");
      expect(result).toContain("kind: ServiceMonitor");
      expect(result).toContain("name: watcher");
      expect(result).toContain("pepr.dev/controller: watcher");
    });
  });
});

describe("Helm Templates", () => {
  describe("Namespace Template", () => {
    test("should generate namespace template correctly", () => {
      const result = nsTemplate();
      expect(result).toContain("kind: Namespace");
      expect(result).toContain("name: pepr-system");
    });
  });

  describe("Chart YAML", () => {
    test("should generate Chart.yaml correctly", () => {
      const name = "test-chart";
      const description = "Test Description";
      const result = chartYaml(name, description);
      expect(result).toContain(`name: ${name}`);
      expect(result).toContain(`description: ${description}`);
      expect(result).toContain("type: application");
      expect(result).toContain("version: 0.1.0");
      expect(result).toContain('appVersion: "1.16.0"');
    });

    test("should handle missing description in Chart.yaml", () => {
      const name = "test-chart";
      const result = chartYaml(name);
      expect(result).toContain(`name: ${name}`);
      expect(result).toContain("description:");
    });
  });

  describe("Watcher Deployment Template", () => {
    test("should generate watcher deployment template correctly", () => {
      const buildTimestamp = "2024-01-01T00:00:00Z";
      const result = watcherDeployTemplate(buildTimestamp);
      expect(result).toContain("kind: Deployment");
      expect(result).toContain(`buildTimestamp: "${buildTimestamp}"`);
      expect(result).toContain("serviceAccountName: {{ .Values.uuid }}");
    });
  });

  describe("Admission Deployment Template", () => {
    test("should generate admission deployment template correctly", () => {
      const buildTimestamp = "2024-01-01T00:00:00Z";
      const result = admissionDeployTemplate(buildTimestamp);
      expect(result).toContain("kind: Deployment");
      expect(result).toContain(`buildTimestamp: "${buildTimestamp}"`);
      expect(result).toContain("serviceAccountName: {{ .Values.uuid }}");
    });
  });

  describe("ClusterRole Template", () => {
    test("should generate cluster role template correctly", () => {
      const customClusterRoleRules: ClusterRoleRule[] = [
        { apiGroups: [""], resources: ["pods"], verbs: ["get", "list"] },
        { apiGroups: ["apps"], resources: ["deployments"], verbs: ["create", "update"] },
      ];
      const result = clusterRoleTemplate(customClusterRoleRules);
      expect(result).toContain("kind: ClusterRole");
      expect(result).toContain('apiGroups: [""]');
      expect(result).toContain('resources: ["pods"]');
      expect(result).toContain('verbs: ["get","list"]');
      expect(result).toContain('apiGroups: ["apps"]');
      expect(result).toContain('resources: ["deployments"]');
      expect(result).toContain('verbs: ["create","update"]');
    });
  });

  describe("Role Template", () => {
    test("should generate role template correctly", () => {
      const customStoreRoleRules: RoleRule[] = [
        { apiGroups: [""], resources: ["configmaps"], verbs: ["get", "create"] },
        { apiGroups: ["core"], resources: ["services"], verbs: ["list", "watch"] },
      ];
      const result = roleTemplate(customStoreRoleRules);
      expect(result).toContain("kind: Role");
      expect(result).toContain("namespace: pepr-system");
      expect(result).toContain('apiGroups: [""]');
      expect(result).toContain('resources: ["configmaps"]');
      expect(result).toContain('verbs: ["get","create"]');
      expect(result).toContain('apiGroups: ["core"]');
      expect(result).toContain('resources: ["services"]');
      expect(result).toContain('verbs: ["list","watch"]');
    });
  });

  describe("ClusterRoleBinding Template", () => {
    test("should generate cluster role binding template correctly", () => {
      const result = clusterRoleBindingTemplate();
      expect(result).toContain("kind: ClusterRoleBinding");
      expect(result).toContain("name: pepr-custom-cluster-role-binding");
      expect(result).toContain("roleRef:");
      expect(result).toContain("kind: ClusterRole");
      expect(result).toContain("name: pepr-custom-cluster-role");
      expect(result).toContain("subjects:");
      expect(result).toContain("kind: ServiceAccount");
      expect(result).toContain("namespace: pepr-system");
    });
  });

  describe("RoleBinding Template", () => {
    test("should generate role binding template correctly", () => {
      const result = roleBindingTemplate();
      expect(result).toContain("kind: RoleBinding");
      expect(result).toContain("name: pepr-custom-role-binding");
      expect(result).toContain("roleRef:");
      expect(result).toContain("kind: Role");
      expect(result).toContain("name: pepr-custom-role");
      expect(result).toContain("subjects:");
      expect(result).toContain("kind: ServiceAccount");
      expect(result).toContain("namespace: pepr-system");
    });
  });

  describe("ServiceMonitor Template", () => {
    test("should generate service monitor template correctly when enabled", () => {
      const name = "admission";
      const result = serviceMonitorTemplate(name);
      expect(result).toContain(`kind: ServiceMonitor`);
      expect(result).toContain(`name: ${name}`);
      expect(result).toContain(`{{- if .Values.${name}.serviceMonitor.enabled }}`);
    });
  });
});
