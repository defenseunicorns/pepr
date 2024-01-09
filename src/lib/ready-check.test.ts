// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, describe, test, jest, beforeEach, afterEach } from "@jest/globals";

import { SpiedFunction } from "jest-mock";

import { checkDeploymentStatus, namespaceDeploymentsReady } from "./ready-check";

describe("checkDeploymentStatus", () => {

  afterEach(()=>{
    jest.clearAllMocks();
  })
  test("should return true if all deployments are ready", async () => {
    const deployments = {
          metadata: {
            name: "pepr-system",
            namespace: "pepr-system-test",
            labels: {
              app: "pepr-system",
            },
          },
          status: {
            readyReplicas: 0,
            replicas: 1,
            updatedReplicas: 1,
            unavailableReplicas: 0,
          },
        }

     jest.mock("kubernetes-fluent-client", () => ({

        K8s: jest.fn().mockReturnValue({
          InNamespace: jest.fn().mockReturnValue({
            Get: ()=>deployments
          }),
        }),

    }));

    const expected = true;
    const result = await checkDeploymentStatus("pepr-system-test");
    expect(result).toBe(expected);

  });

  test("should return false if any deployments are not ready", async () => {
    const deployments = {
      metadata: {
        name: "pepr-system",
        namespace: "pepr-system-test",
        labels: {
          app: "pepr-system",
        },
      },
      status: {
        readyReplicas: 1,
        replicas: 2,
        updatedReplicas: 1,
        unavailableReplicas: 0,
      },
    }

    jest.mock("kubernetes-fluent-client", async () => {
      return {
        K8s: jest.fn().mockReturnValue({
          InNamespace: jest.fn().mockReturnValue({
            Get: jest.fn().mockReturnValue(deployments),
          }),
        }),
        kind: jest.fn(),
      };
    });

    const expected = false;
    const result = await checkDeploymentStatus("pepr-system");
    expect(result).toBe(expected);

  });
});
describe("namespaceDeploymentsReady", () => {

  test("should return true if all deployments are ready", async () => {
    jest.mock('./ready-check', ()=>({
      checkDeploymentStatus: async ()=>true
    }));

    const expected = true;
    const result = await namespaceDeploymentsReady();
    console.log('result', result);
    expect(result).toBe(expected);
  });

  test("should call checkDeploymentStatus if any deployments are not ready", async () => {

    let counter = 0;
    jest.mock('./ready-check', ()=>({
      checkDeploymentStatus: async ()=>{
      console.log('testing counter')
      if (counter < 2) {
        counter++;
        return false
      } else {
        return true
      }
      }
    }));

    const expected = true;
    const result = await namespaceDeploymentsReady("pepr-system-test");
    expect(result).toBe(expected);
    expect(counter).toBe(2);
    console.log('counter ->', counter);
  });
});