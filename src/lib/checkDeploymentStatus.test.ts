/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, jest, beforeEach, afterEach, it, expect } from "@jest/globals";
import { K8s } from "kubernetes-fluent-client";
import { checkDeploymentStatus } from "./checkDeploymentStatus";
import { namespaceDeploymentsReady } from "./helpers";

describe("checkDeploymentStatus", () => {
  const mockK8s = jest.mocked(K8s);

  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    jest.useRealTimers();
  });
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

    expect(mockK8s).toHaveBeenCalledTimes(1);
  });
});
