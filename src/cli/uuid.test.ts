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

  it("should fetch deployments without uuid", async () => {
    const result = await getPeprDeploymentsByUUID();

    expect(result.items[0].metadata?.labels?.["pepr.dev/uuid"]).toBe("1234");
    expect(result.items[0].metadata?.annotations?.["pepr.dev/description"]).toBe("Test annotation");
  });

  it("should fetch deployments with a specific uuid", async () => {
    const result = await getPeprDeploymentsByUUID("abcd-uuid");

    expect(result.items[0].metadata?.labels?.["pepr.dev/uuid"]).toBe("1234");
  });
});

describe("uuid CLI command", () => {
  let program: Command;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    uuid(program);
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("should log UUID and description when deployment has a UUID", async () => {
    await program.parseAsync(["uuid"], { from: "user" });

    expect(logSpy).toHaveBeenCalledWith("UUID\t\tDescription");
    expect(logSpy).toHaveBeenCalledWith("--------------------------------------------");
    expect(logSpy).toHaveBeenCalledWith("1234\tTest annotation");
    expect(logSpy).toHaveBeenCalledWith("asdf\tAnother annotation");
  });

  it("should log UUID and description when deployment has a matching UUID", async () => {
    await program.parseAsync(["uuid", "asdf"], { from: "user" });
    expect(logSpy).toHaveBeenCalledWith("UUID\t\tDescription");
    expect(logSpy).toHaveBeenCalledWith("--------------------------------------------");
    expect(logSpy).toHaveBeenCalledWith("asdf\tAnother annotation");
  });
});
