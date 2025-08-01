// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { describe, expect, it, vi, beforeEach } from "vitest";
import uuid, { getPeprDeploymentsByUUID, buildUUIDTable } from "./uuid";
import { Command } from "commander";
import type { kind } from "kubernetes-fluent-client";
import { KubernetesListObject } from "@kubernetes/client-node";

vi.mock("kubernetes-fluent-client", async () => {
  const actual = await vi.importActual<typeof import("kubernetes-fluent-client")>(
    "kubernetes-fluent-client",
  );

  const Get = vi.fn().mockResolvedValue({
    items: [
      {
        metadata: {
          name: "test-deployment",
          labels: { "pepr.dev/uuid": "1234" },
          annotations: { "pepr.dev/description": "Test annotation" },
        },
      },
      {
        metadata: {
          name: "other-deployment",
          labels: { "pepr.dev/uuid": "asdf" },
          annotations: { "pepr.dev/description": "Another annotation" },
        },
      },
    ],
  });

  const WithLabel = vi.fn().mockReturnValue({ Get });
  const InNamespace = vi.fn().mockReturnValue({ WithLabel });

  const K8sMock = vi.fn().mockReturnValue({ InNamespace });

  return {
    ...actual,
    K8s: K8sMock,
    kind: actual.kind,
  };
});

describe("buildUUIDTable", () => {
  it("should build table with UUID and description", () => {
    const deployments: KubernetesListObject<kind.Deployment> = {
      apiVersion: "v1",
      kind: "List",
      items: [
        {
          metadata: {
            name: "test-deploy",
            labels: { "pepr.dev/uuid": "1234" },
            annotations: { "pepr.dev/description": "Test annotation" },
          },
        },
      ],
    };

    const result = buildUUIDTable(deployments);
    expect(result).toEqual({ "1234": "Test annotation" });
  });

  it("should include UUID with empty description if none is present", () => {
    const deployments: KubernetesListObject<kind.Deployment> = {
      apiVersion: "v1",
      kind: "List",
      items: [
        {
          metadata: {
            name: "no-desc",
            labels: { "pepr.dev/uuid": "5678" },
          },
        },
      ],
    };

    const result = buildUUIDTable(deployments);
    expect(result).toEqual({ "5678": "" });
  });

  it("should skip deployments without UUID", () => {
    const deployments: KubernetesListObject<kind.Deployment> = {
      apiVersion: "v1",
      kind: "List",
      items: [
        {
          metadata: {
            name: "no-uuid",
            annotations: { "pepr.dev/description": "Should be ignored" },
          },
        },
      ],
    };

    const result = buildUUIDTable(deployments);
    expect(result).toEqual({});
  });
});
describe("getPeprDeploymentsByUUID", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch all deployments", async () => {
    const result = await getPeprDeploymentsByUUID();

    expect(result.items[0].metadata?.labels?.["pepr.dev/uuid"]).toBe("1234");
    expect(result.items[0].metadata?.annotations?.["pepr.dev/description"]).toBe("Test annotation");
    expect(result.items[1].metadata?.labels?.["pepr.dev/uuid"]).toBe("asdf");
    expect(result.items[1].metadata?.annotations?.["pepr.dev/description"]).toBe(
      "Another annotation",
    );
    expect(result.items.length).toBe(2);
  });

  it("should fetch deployments with a specific uuid", async () => {
    const result = await getPeprDeploymentsByUUID("1234");

    expect(result.items[0].metadata?.labels?.["pepr.dev/uuid"]).toBe("1234");
    expect(result.items[0].metadata?.annotations?.["pepr.dev/description"]).toBe("Test annotation");
    expect(result.items.length).toBe(1);
  });
});

describe("uuid CLI command", () => {
  let program: Command;
  let tableSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    uuid(program);
    tableSpy = vi.spyOn(console, "table").mockImplementation(() => {});
  });

  it("should display UUID table for all deployments with a UUID", async () => {
    await program.parseAsync(["uuid"], { from: "user" });

    expect(tableSpy).toHaveBeenCalledWith([
      { UUID: "1234", Description: "Test annotation" },
      { UUID: "asdf", Description: "Another annotation" },
    ]);
  });

  it("should display UUID table for a specific deployment with a matching UUID", async () => {
    await program.parseAsync(["uuid", "asdf"], { from: "user" });

    expect(tableSpy).toHaveBeenCalledWith([{ UUID: "asdf", Description: "Another annotation" }]);
  });
});
