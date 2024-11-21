/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, jest, beforeEach, afterEach, it, expect } from "@jest/globals";
import { checkDeploymentStatus } from "./deploymentChecks";
import { namespaceDeploymentsReady } from "./helpers";
import { GenericClass, K8s, KubernetesObject } from "kubernetes-fluent-client";
import { K8sInit } from "kubernetes-fluent-client/dist/fluent/types";

const mockK8s = jest.mocked(K8s);

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

  describe("namespaceDeployments ready", () => {
    const mockK8s = jest.mocked(K8s);

    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.clearAllMocks();
      jest.resetAllMocks();
      jest.useRealTimers();
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

      mockK8s
        .mockImplementation(<T extends GenericClass, K extends KubernetesObject>() => {
          return {
            InNamespace: jest.fn().mockReturnThis(),
            Get: () => deployments,
          } as unknown as K8sInit<T, K>;
        })
        .mockImplementation(<T extends GenericClass, K extends KubernetesObject>() => {
          return {
            InNamespace: jest.fn().mockReturnThis(),
            Get: () => deployments2,
          } as unknown as K8sInit<T, K>;
        });

      const expected = true;
      const result = await namespaceDeploymentsReady();

      expect(result).toBe(expected);

      expect(mockK8s).toHaveBeenCalledTimes(1);
    });
  });
});
