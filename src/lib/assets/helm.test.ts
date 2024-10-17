// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { nsTemplate, chartYaml, watcherDeployTemplate, admissionDeployTemplate, serviceMonitorTemplate } from "./helm";
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
