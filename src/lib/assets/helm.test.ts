// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors
import { generateContainerPorts, generateCommand } from "./helm";
import { nsTemplate, chartYaml, watcherDeployTemplate, admissionDeployTemplate } from "./helm";
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
});

describe("Testing environment based configurations", () => {
  describe("generateContainerPorts", () => {
    test("should return debug ports when PEPR_DEBUG is true", () => {
      process.env.PEPR_DEBUG = "true";
      const result = generateContainerPorts();
      expect(result.trim()).toBe(
        `
                  - containerPort: 3000
                  - containerPort: 9229
      `.trim(),
      );
    });

    test("should return non-debug ports when PEPR_DEBUG is not true", () => {
      process.env.PEPR_DEBUG = "false";
      const result = generateContainerPorts();
      expect(result.trim()).toBe(
        `
                  - containerPort: 3000
      `.trim(),
      );
    });
  });

  describe("generateCommand", () => {
    test("should return debug command when PEPR_DEBUG is true", () => {
      process.env.PEPR_DEBUG = "true";
      const result = generateCommand();
      expect(result.trim()).toBe(
        `
                - node
                - inspect=0.0.0.0:9229
                - /app/node_modules/pepr/dist/controller.js
                - {{ .Values.hash }}
      `.trim(),
      );
    });

    test("should return non-debug command when PEPR_DEBUG is not true", () => {
      process.env.PEPR_DEBUG = "false";
      const result = generateCommand();
      expect(result.trim()).toBe(
        `
                - node
                - /app/node_modules/pepr/dist/controller.js
                - {{ .Values.hash }}
        `.trim(),
      );
    });
  });
});
