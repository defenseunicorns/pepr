// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import {
  namespaceTemplate,
  chartYaml,
  watcherDeployTemplate,
  admissionDeployTemplate,
  serviceMonitorTemplate,
} from "./helm";
import { expect, describe, test } from "@jest/globals";
describe("Kubernetes Template Generators", () => {
  describe("nsTemplate", () => {
    test("should generate a Namespace template correctly", () => {
      const result = namespaceTemplate();
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
