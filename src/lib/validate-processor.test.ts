import { describe, expect, it } from "@jest/globals";
import { validateProcessor } from "./validate-processor";
import { Capability } from "./capability";
import { KubernetesObject } from "kubernetes-fluent-client";
import { AdmissionRequest, CapabilityCfg } from "./types";
import { Operation } from "./enums";

describe("validate-processor tests", () => {
  const defaultCapabilityConfig: CapabilityCfg = {
    name: "test-capability",
    description: "Test capability description",
    namespaces: ["default"],
  };

  const defaultModuleConfig = { uuid: "some-uuid", alwaysIgnore: { namespaces: [] } };
  const defaultCapabilities: Capability[] = [new Capability(defaultCapabilityConfig)];
  const defaultRequestMetadata = {};
  const defaultKind = {
    group: "",
    version: "v1",
    kind: "Pod",
  };
  const defaultRequest: AdmissionRequest<KubernetesObject> = {
    operation: Operation.CREATE,
    uid: "test-uid",
    kind: defaultKind,
    resource: {
      group: "",
      version: "v1",
      resource: "pods",
    },
    name: "test-pod",
    userInfo: {
      username: "test-user",
      groups: ["test-group"],
    },
    object: {
      apiVersion: "v1",
      kind: "Pod",
      metadata: {
        name: "test-pod",
        labels: {
          "test-label": "true",
        },
        annotations: {
          "test-annotation": "true",
        },
      },
    },
  };

  it("should return an empty validate response", async () => {
    const result = await validateProcessor(
      defaultModuleConfig,
      defaultCapabilities,
      defaultRequest,
      defaultRequestMetadata,
    );
    expect(result).toStrictEqual([]);
  });

  it("TODO: should do something when secret", async () => {
    const request = { ...defaultRequest, kind: { group: "", kind: "Secret", version: "v1" } };
    const result = await validateProcessor(defaultModuleConfig, defaultCapabilities, request, defaultRequestMetadata);
    expect(result).toStrictEqual([]);
  });

  it("TODO should do something with bindings", async () => {
    const capabilities: Capability[] = [new Capability({ ...defaultCapabilityConfig })];
    const request = { ...defaultRequest, kind: { group: "", kind: "Secret", version: "v1" } };
    const result = await validateProcessor(defaultModuleConfig, capabilities, request, defaultRequestMetadata);
    expect(result).toStrictEqual([]);
  });
});
