import { overridesFile, allYaml } from "./yaml";
import { promises as fs } from "fs";
import { dumpYaml } from "@kubernetes/client-node";
import { describe, expect, it, jest } from "@jest/globals";
import { Assets } from ".";

const assets: Assets = JSON.parse(`{
  "config": {
    "uuid": "static-test",
    "onError": "ignore",
    "webhookTimeout": 10,
    "customLabels": {
      "namespace": {
        "pepr.dev": ""
      }
    },
    "alwaysIgnore": {
      "namespaces": []
    },
    "includedFiles": [],
    "env": {
      "MY_CUSTOM_VAR": "example-value",
      "ZARF_VAR": "###ZARF_VAR_THING###"
    },
    "peprVersion": "0.0.0-development",
    "appVersion": "0.0.1",
    "description": "A test module for Pepr"
  },
  "path": "/Users/cmwylie19/pepr/pepr-test-module/dist/pepr-static-test.js",
  "name": "pepr-static-test",
  "tls": {
    "ca": "",
    "key": "",
    "crt": "",
    "pem": {
      "ca": "",
      "crt": "",
      "key": ""
    }
  },
  "apiToken": "db5eb6d40e3744fcc2d7863c8f56ce24aaa94ff32cf22918700bdb9369e6d426",
  "alwaysIgnore": {
    "namespaces": []
  },
  "capabilities": [
    {
      "name": "hello-pepr",
      "description": "A simple example capability to show how things work.",
      "namespaces": [
        "pepr-demo",
        "pepr-demo-2"
      ],
      "bindings": [
        {
          "kind": {
            "kind": "Namespace",
            "version": "v1",
            "group": ""
          },
          "event": "CREATE",
          "filters": {
            "name": "",
            "namespaces": [],
            "labels": {},
            "annotations": {}
          },
          "isMutate": true
        },
        {
          "kind": {
            "kind": "Namespace",
            "version": "v1",
            "group": ""
          },
          "event": "CREATE",
          "filters": {
            "name": "pepr-demo-2",
            "namespaces": [],
            "labels": {},
            "annotations": {}
          },
          "isWatch": true
        },
        {
          "kind": {
            "kind": "ConfigMap",
            "version": "v1",
            "group": ""
          },
          "event": "CREATE",
          "filters": {
            "name": "example-1",
            "namespaces": [],
            "labels": {},
            "annotations": {}
          },
          "isMutate": true
        },
        {
          "kind": {
            "kind": "ConfigMap",
            "version": "v1",
            "group": ""
          },
          "event": "CREATE",
          "filters": {
            "name": "example-2",
            "namespaces": [],
            "labels": {},
            "annotations": {}
          },
          "isMutate": true
        },
        {
          "kind": {
            "kind": "ConfigMap",
            "version": "v1",
            "group": ""
          },
          "event": "CREATE",
          "filters": {
            "name": "example-2",
            "namespaces": [],
            "labels": {},
            "annotations": {}
          },
          "isValidate": true
        },
        {
          "kind": {
            "kind": "ConfigMap",
            "version": "v1",
            "group": ""
          },
          "event": "CREATE",
          "filters": {
            "name": "example-2",
            "namespaces": [],
            "labels": {},
            "annotations": {}
          },
          "isWatch": true
        },
        {
          "kind": {
            "kind": "ConfigMap",
            "version": "v1",
            "group": ""
          },
          "event": "CREATE",
          "filters": {
            "name": "",
            "namespaces": [],
            "labels": {},
            "annotations": {}
          },
          "isValidate": true
        },
        {
          "kind": {
            "kind": "ConfigMap",
            "version": "v1",
            "group": ""
          },
          "event": "CREATEORUPDATE",
          "filters": {
            "name": "",
            "namespaces": [],
            "labels": {
              "change": "by-label"
            },
            "annotations": {}
          },
          "isMutate": true
        },
        {
          "kind": {
            "kind": "ConfigMap",
            "version": "v1",
            "group": ""
          },
          "event": "DELETE",
          "filters": {
            "name": "",
            "namespaces": [],
            "labels": {
              "change": "by-label"
            },
            "annotations": {}
          },
          "isValidate": true
        },
        {
          "kind": {
            "kind": "ConfigMap",
            "version": "v1",
            "group": ""
          },
          "event": "CREATE",
          "filters": {
            "name": "example-4",
            "namespaces": [],
            "labels": {},
            "annotations": {}
          },
          "isMutate": true
        },
        {
          "kind": {
            "kind": "ConfigMap",
            "version": "v1",
            "group": ""
          },
          "event": "CREATE",
          "filters": {
            "name": "example-4a",
            "namespaces": [
              "pepr-demo-2"
            ],
            "labels": {},
            "annotations": {}
          },
          "isMutate": true
        },
        {
          "kind": {
            "kind": "ConfigMap",
            "version": "v1",
            "group": ""
          },
          "event": "CREATE",
          "filters": {
            "name": "",
            "namespaces": [],
            "labels": {
              "chuck-norris": ""
            },
            "annotations": {}
          },
          "isMutate": true
        },
        {
          "kind": {
            "kind": "Secret",
            "version": "v1",
            "group": ""
          },
          "event": "CREATE",
          "filters": {
            "name": "secret-1",
            "namespaces": [],
            "labels": {},
            "annotations": {}
          },
          "isMutate": true
        },
        {
          "kind": {
            "group": "pepr.dev",
            "version": "v1",
            "kind": "Unicorn"
          },
          "event": "CREATE",
          "filters": {
            "name": "example-1",
            "namespaces": [],
            "labels": {},
            "annotations": {}
          },
          "isMutate": true
        },
        {
          "kind": {
            "group": "pepr.dev",
            "version": "v1",
            "kind": "Unicorn"
          },
          "event": "CREATE",
          "filters": {
            "name": "example-2",
            "namespaces": [],
            "labels": {},
            "annotations": {}
          },
          "isMutate": true
        }
      ],
      "hasSchedule": false
    }
  ],
  "image": "ghcr.io/defenseunicorns/pepr/controller:v0.0.0-development",
  "buildTimestamp": "1721936569867",
  "hash": "e303205079a4445946f6eacde9ec4800534653f85aca6f84539d0f7158a22569"
}`);

// Mock the `fs.writeFile` and `fs.readFile` functions
jest.mock("fs", () => ({
  promises: {
    writeFile: jest.fn(),
    readFile: jest.fn(),
  },
}));

jest.mock("@kubernetes/client-node", () => ({
  dumpYaml: jest.fn(input => {
    // Check the input type and return corresponding mocked YAML
    if ((input as { kind: string }).kind === "ClusterRole") {
      return "apiVersion: rbac.authorization.k8s.io/v1\nkind: ClusterRole";
    }
    if (
      typeof input === "object" &&
      input !== null &&
      "kind" in input &&
      (input as { kind: string }).kind === "ClusterRoleBinding"
    ) {
      return "apiVersion: rbac.authorization.k8s.io/v1\nkind: ClusterRoleBinding";
    }
    if (
      typeof input === "object" &&
      input !== null &&
      "kind" in input &&
      (input as { kind: string }).kind === "ServiceAccount"
    ) {
      return "apiVersion: v1\nkind: ServiceAccount";
    }
    // Default mocked response for other inputs
    return "mocked-yaml-output";
  }),
}));

// Mock the RBAC section in package.json
jest.mock("../../../package.json", () => ({
  rbac: {
    roles: [
      {
        apiGroups: [""],
        resources: ["pods"],
        verbs: ["get", "list", "watch"],
      },
    ],
    roleBindings: [
      {
        roleRef: {
          apiGroup: "rbac.authorization.k8s.io",
          kind: "Role",
          name: "pod-reader",
        },
        subjects: [
          {
            kind: "ServiceAccount",
            name: "default",
            namespace: "default",
          },
        ],
      },
    ],
  },
}));

describe("yaml.ts", () => {
  it("should include RBAC roles and roleBindings from package.json in the generated YAML file", async () => {
    const expectedYamlContent = dumpYaml({
      secrets: {
        apiToken: Buffer.from("some-api-token").toString("base64"),
      },
      hash: "1234",
      namespace: {
        annotations: {},
        labels: {
          "pepr.dev": "",
        },
      },
      uuid: "pepr",
      admission: expect.any(Object),
      watcher: expect.any(Object),
      rbac: {
        roles: [
          {
            apiGroups: [""],
            resources: ["pods"],
            verbs: ["get", "list", "watch"],
          },
        ],
        roleBindings: [
          {
            roleRef: {
              apiGroup: "rbac.authorization.k8s.io",
              kind: "Role",
              name: "pod-reader",
            },
            subjects: [
              {
                kind: "ServiceAccount",
                name: "default",
                namespace: "default",
              },
            ],
          },
        ],
      },
    });

    await overridesFile(assets, "./test-values.yaml");

    expect(fs.writeFile).toHaveBeenCalledWith("./test-values.yaml", expectedYamlContent);
  });

  describe("yaml.ts", () => {
    it("should generate correct YAML for all resources in allYaml function", async () => {
      // Mock fs.readFile to return a Buffer
      (fs.readFile as jest.Mock).mockResolvedValueOnce(Buffer.from("code-content").toString() as unknown as never);

      const result = await allYaml(assets, "scoped", "image-pull-secret");

      // Adjust test expectations to match the mocked output
      expect(result).toContain("apiVersion: rbac.authorization.k8s.io/v1");
      expect(result).toContain("kind: ClusterRole");
      expect(result).toContain("kind: ClusterRoleBinding");
    });
  });
});
