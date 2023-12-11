// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { KubernetesListObject, kind } from "kubernetes-fluent-client";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { waitForAllDeploymentReplicas } from "./deploy-helpers";

const mockReadyDeployments = {
  items: [
    {
      metadata: {
        name: "test-deployment1",
      },
      status: {
        readyReplicas: 1,
      },
      spec: {
        replicas: 1,
      },
    },
    {
      metadata: {
        name: "test-deployment2",
      },
      status: {
        readyReplicas: 2,
      },
      spec: {
        replicas: 2,
      },
    },
    {
      metadata: {
        name: "test-deployment3",
      },
      status: {
        readyReplicas: 3,
      },
      spec: {
        replicas: 3,
      },
    },
  ],
} as KubernetesListObject<kind.Deployment>;

const mockNotReadyDeployments = {
  items: [
    {
      metadata: {
        name: "test-deployment1",
      },
      status: {
        readyReplicas: 1,
      },
      spec: {
        replicas: 1,
      },
    },
    {
      metadata: {
        name: "test-deployment2",
      },
      status: {
        readyReplicas: 2,
      },
      spec: {
        replicas: 2,
      },
    },
    {
      metadata: {
        name: "test-deployment3",
      },
      status: {
        readyReplicas: 2,
      },
      spec: {
        replicas: 3,
      },
    },
  ],
} as KubernetesListObject<kind.Deployment>;

describe("deploy-helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getDeployments", () => {
    it("should get all deployments when all replicas are ready", async () => {
      const mockGetDeployments = jest.fn().mockReturnValue(mockReadyDeployments);
      const deployments = await mockGetDeployments();

      expect(deployments).toEqual(mockReadyDeployments);
    });

    it("should get all deployments when some replicas are not ready", async () => {
      const mockGetDeployments = jest.fn().mockReturnValue(mockNotReadyDeployments);
      const deployments = await mockGetDeployments();

      expect(deployments).toEqual(mockNotReadyDeployments);
    });
  });

  describe("waitForAllDeploymentReplicas", () => {
    it("should return true when all replicas are ready", async () => {
      const status = await waitForAllDeploymentReplicas(mockReadyDeployments);

      expect(status).toEqual(true);
    });

    it("should return false when there are no deployments", async () => {
      const mockNoDeployments = {
        items: [],
      } as KubernetesListObject<kind.Deployment>;

      const status = await waitForAllDeploymentReplicas(mockNoDeployments);

      expect(status).toEqual(false);
    });
  });
});
