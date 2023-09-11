// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { describe, expect, it } from "@jest/globals";

import { Filters, QueryParams } from "./types";
import { queryBuilder } from "./utils";

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
