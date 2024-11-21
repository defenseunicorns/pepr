/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect } from "@jest/globals";
import { checkDeploymentStatus } from "./checkDeploymentStatus";
import { namespaceDeploymentsReady } from "./helpers";

describe("checkDeploymentStatus", () => {
  it("should return true if all deployments are ready", async () => {
    const deployments = {
      items: [
        {
          metadata: {
            name: "watcher",
            namespace: "pepr-system",
          },
          spec: {
            replicas: 1,
          },
          status: {
            readyReplicas: 1,
          },
        },
        {
          metadata: {
            name: "admission",
            namespace: "pepr-system",
          },
          spec: {
            replicas: 2,
          },
          status: {
            readyReplicas: 2,
          },
        },
      ],
    };

    const expected = true;
    const result = await checkDeploymentStatus("pepr-system");
    expect(result).toBe(expected);
  });

  describe("when any deployments are not ready", () => {
    it("should return false", async () => {
      const deployments = {
        items: [
          {
            metadata: {
              name: "watcher",
              namespace: "pepr-system",
            },
            spec: {
              replicas: 1,
            },
            status: {
              readyReplicas: 1,
            },
          },
          {
            metadata: {
              name: "admission",
              namespace: "pepr-system",
            },
            spec: {
              replicas: 2,
            },
            status: {
              readyReplicas: 1,
            },
          },
        ],
      };

      const expected = false;
      const result = await checkDeploymentStatus("pepr-system");
      expect(result).toBe(expected);
    });
  });

  it("should call checkDeploymentStatus", async () => {
    const deployments = {
      items: [
        {
          metadata: {
            name: "watcher",
            namespace: "pepr-system",
          },
          spec: {
            replicas: 1,
          },
          status: {
            readyReplicas: 1,
          },
        },
        {
          metadata: {
            name: "admission",
            namespace: "pepr-system",
          },
          spec: {
            replicas: 2,
          },
          status: {
            readyReplicas: 1,
          },
        },
      ],
    };

    const deployments2 = {
      items: [
        {
          metadata: {
            name: "watcher",
            namespace: "pepr-system",
          },
          spec: {
            replicas: 1,
          },
          status: {
            readyReplicas: 1,
          },
        },
        {
          metadata: {
            name: "admission",
            namespace: "pepr-system",
          },
          spec: {
            replicas: 2,
          },
          status: {
            readyReplicas: 2,
          },
        },
      ],
    };

    const expected = true;
    const result = await namespaceDeploymentsReady();

    expect(result).toBe(expected);
  });
});
