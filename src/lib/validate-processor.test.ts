import { describe, expect, it } from "@jest/globals";
import { validateProcessor } from "./validate-processor";
import { Capability } from "./capability";
import { KubernetesObject } from "kubernetes-fluent-client";
import { AdmissionRequest } from "./types";
import { Operation } from "./enums";

describe("validate-processor tests", () => {
  const defaultModuleConfig = { uuid: "some-uuid", alwaysIgnore: { namespaces: [] } };
  const defaultCapabilities: Capability[] = [];
  const defaultRequestMetadata = {};
  const defaultRequest: AdmissionRequest<KubernetesObject> = {
    operation: Operation.CREATE,
    uid: "test-uid",
    kind: {
      group: "",
      version: "v1",
      kind: "Pod",
    },
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
});
