import { describe, vi, it, beforeEach, afterEach, expect } from "vitest";
import { K8s, GenericClass, KubernetesObject } from "kubernetes-fluent-client";
import { K8sInit } from "kubernetes-fluent-client/dist/fluent/types";
import { checkDeploymentStatus, namespaceDeploymentsReady } from "./deploymentChecks";

vi.mock("kubernetes-fluent-client", () => {
  return {
    K8s: vi.fn(),
    kind: vi.fn(),
  };
});

describe("namespaceDeploymentsReady", () => {
  const mockK8s = vi.mocked(K8s);

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    vi.useRealTimers();
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

    mockK8s.mockImplementation(<T extends GenericClass, K extends KubernetesObject>() => {
      return {
        InNamespace: vi.fn().mockReturnThis(),
        Get: () => deployments,
      } as unknown as K8sInit<T, K>;
    });

    const expected = true;
    const result = await namespaceDeploymentsReady();
    expect(result).toBe(expected);
  });

  it("should call checkDeploymentStatus if any deployments are not ready", async () => {
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
          InNamespace: vi.fn().mockReturnThis(),
          Get: () => deployments,
        } as unknown as K8sInit<T, K>;
      })
      .mockImplementation(<T extends GenericClass, K extends KubernetesObject>() => {
        return {
          InNamespace: vi.fn().mockReturnThis(),
          Get: () => deployments2,
        } as unknown as K8sInit<T, K>;
      });

    const expected = true;
    const result = await namespaceDeploymentsReady();

    expect(result).toBe(expected);

    expect(mockK8s).toHaveBeenCalledTimes(1);
  });
});

describe("checkDeploymentStatus", () => {
  const mockK8s = vi.mocked(K8s);

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    vi.useRealTimers();
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

    mockK8s.mockImplementation(<T extends GenericClass, K extends KubernetesObject>() => {
      return {
        InNamespace: vi.fn().mockReturnThis(),
        Get: () => deployments,
      } as unknown as K8sInit<T, K>;
    });

    const expected = true;
    const result = await checkDeploymentStatus("pepr-system");
    expect(result).toBe(expected);
  });

  it("should return false if any deployments are not ready", async () => {
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

    mockK8s.mockImplementation(<T extends GenericClass, K extends KubernetesObject>() => {
      return {
        InNamespace: vi.fn().mockReturnThis(),
        Get: () => deployments,
      } as unknown as K8sInit<T, K>;
    });

    const expected = false;
    const result = await checkDeploymentStatus("pepr-system");
    expect(result).toBe(expected);
  });
});
