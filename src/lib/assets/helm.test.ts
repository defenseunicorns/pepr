// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import {
  namespaceTemplate,
  chartYaml,
  watcherDeployTemplate,
  admissionDeployTemplate,
  serviceTemplate,
  serviceMonitorTemplate,
} from "./helm";
import { expect, describe, it } from "vitest";
describe("Kubernetes Template Generators", () => {
  describe("nsTemplate", () => {
    it("should generate a Namespace template correctly", () => {
      const result = namespaceTemplate();
      expect(result).toContain("apiVersion: v1");
      expect(result).toContain("kind: Namespace");
      expect(result).toContain("name: pepr-system");
    });
  });

  describe("chartYaml", () => {
    it("should generate a Chart.yaml content correctly", () => {
      const name = "test-app";
      const description = "A test application";
      const result = chartYaml(name, description);
      expect(result).toContain("apiVersion: v2");
      expect(result).toContain(`name: ${name}`);
      expect(result).toContain(`description: ${description}`);
    });
  });

  describe("watcherDeployTemplate", () => {
    it("should generate a Deployment template for the watcher correctly", () => {
      const result = watcherDeployTemplate(`${Date.now()}`, "watcher");
      expect(result).toContain("apiVersion: apps/v1");
      expect(result).toContain("kind: Deployment");
      expect(result).toContain("name: {{ .Values.uuid }}-watcher");
    });
  });

  describe("admissionDeployTemplate", () => {
    it("should generate a Deployment template for the admission controller correctly", () => {
      const result = admissionDeployTemplate(`${Date.now()}`, "admission");
      expect(result).toContain("apiVersion: apps/v1");
      expect(result).toContain("kind: Deployment");
      expect(result).toContain("name: {{ .Values.uuid }}");
    });
  });

  describe("admissionServiceMonitor", () => {
    it("should generate a Service Monitor template for the admission controller correctly", () => {
      const result = serviceMonitorTemplate("admission", "admission");
      expect(result).toContain("apiVersion: monitoring.coreos.com/v1");
      expect(result).toContain("kind: ServiceMonitor");
      expect(result).toContain("name: admission");
      expect(result).toContain("pepr.dev/controller: admission");
    });
  });

  describe("watcherServiceMonitor", () => {
    it("should generate a Service Monitor template for the watcher controller correctly", () => {
      const result = serviceMonitorTemplate("watcher", "watcher");
      expect(result).toContain("apiVersion: monitoring.coreos.com/v1");
      expect(result).toContain("kind: ServiceMonitor");
      expect(result).toContain("name: watcher");
      expect(result).toContain("pepr.dev/controller: watcher");
    });
  });

  // Finding #9: imagePullSecrets must be at spec.template.spec level (sibling of
  // containers/volumes), not nested inside a container definition. Kubernetes
  // silently ignores imagePullSecrets when it appears inside a container item,
  // so private registry pulls fail without any error.
  describe("imagePullSecrets placement", () => {
    /** Return the leading whitespace width of the first line containing `field`. */
    function indentOf(template: string, field: string): number {
      const line = template.split("\n").find(l => l.trimStart().startsWith(field));
      if (!line) {
        throw new Error(`Field "${field}" not found in template`);
      }
      return line.length - line.trimStart().length;
    }

    it("watcherDeployTemplate: imagePullSecrets is at pod spec level, not inside a container", () => {
      const result = watcherDeployTemplate(`${Date.now()}`, "watcher");
      const containersIndent = indentOf(result, "containers:");
      const imagePullSecretsIndent = indentOf(result, "imagePullSecrets:");

      expect(imagePullSecretsIndent).toBe(containersIndent);
    });

    it("admissionDeployTemplate: imagePullSecrets is at pod spec level, not inside a container", () => {
      const result = admissionDeployTemplate(`${Date.now()}`, "admission");
      const containersIndent = indentOf(result, "containers:");
      const imagePullSecretsIndent = indentOf(result, "imagePullSecrets:");

      expect(imagePullSecretsIndent).toBe(containersIndent);
    });
  });

  describe("serviceTemplate", () => {
    it("should generate a Service template correctly", () => {
      const result = serviceTemplate("test-service", "watcher");
      expect(result).toContain("apiVersion: v1");
      expect(result).toContain("kind: Service");
      expect(result).toContain("name: test-service-watcher");
      expect(result).toContain("app: test-service-watcher");
      expect(result).toContain("pepr.dev/controller: watcher");
    });
  });
});
