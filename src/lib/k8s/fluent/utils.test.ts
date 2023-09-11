// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { describe, expect, it, jest } from "@jest/globals";

import { GenericClass } from "../../types";
import { ClusterRole, Ingress, Pod } from "../upstream";
import { Filters, QueryParams } from "./types";
import { pathBuilder, queryBuilder } from "./utils";

jest.mock("@kubernetes/client-node");
jest.mock("https");

describe("queryBuilder Function", () => {
  it("should return an empty object if no filters are provided", () => {
    const filters: Filters = {};
    const result: QueryParams = queryBuilder(filters);
    expect(result).toEqual({});
  });

  it("should correctly build query parameters for fields", () => {
    const filters: Filters = {
      fields: {
        field1: "value1",
        field2: "value2",
      },
    };
    const result: QueryParams = queryBuilder(filters);
    expect(result).toEqual({
      fieldSelector: "field1=value1,field2=value2",
    });
  });

  it("should correctly build query parameters for labels", () => {
    const filters: Filters = {
      labels: {
        label1: "value1",
        label2: "value2",
      },
    };
    const result: QueryParams = queryBuilder(filters);
    expect(result).toEqual({
      labelSelector: "label1=value1,label2=value2",
    });
  });

  it("should correctly build query parameters for multiple filter types", () => {
    const filters: Filters = {
      fields: {
        field1: "value1",
      },
      labels: {
        label1: "value1",
      },
    };
    const result: QueryParams = queryBuilder(filters);
    expect(result).toEqual({
      fieldSelector: "field1=value1",
      labelSelector: "label1=value1",
    });
  });
});

describe("pathBuilder Function", () => {
  it("should throw an error if the kind is not specified and the model is not a KubernetesObject", () => {
    const model = { name: "Unknown" } as unknown as GenericClass;
    const filters: Filters = {};
    expect(() => pathBuilder(model, filters)).toThrow("Kind not specified for Unknown");
  });

  it("should generate a path for core group kinds", () => {
    const filters: Filters = { namespace: "default", name: "mypod" };
    const result = pathBuilder(Pod, filters);
    expect(result).toEqual("/api/v1/namespaces/default/pods/mypod");
  });

  it("should generate a path for non-core group kinds", () => {
    const filters: Filters = {
      namespace: "default",
      name: "myingress",
    };
    const result = pathBuilder(Ingress, filters);
    expect(result).toEqual("/apis/networking.k8s.io/v1/namespaces/default/ingresses/myingress");
  });

  it("should generate a path without a namespace if not provided", () => {
    const filters: Filters = { name: "tester" };
    const result = pathBuilder(ClusterRole, filters);
    expect(result).toEqual("/apis/rbac.authorization.k8s.io/v1/clusterroles/tester");
  });

  it("should generate a path without a name if excludeName is true", () => {
    const filters: Filters = { namespace: "default", name: "mypod" };
    const result = pathBuilder(Pod, filters, true);
    expect(result).toEqual("/api/v1/namespaces/default/pods");
  });
});
