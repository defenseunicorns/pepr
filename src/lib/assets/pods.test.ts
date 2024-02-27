import { namespace } from "./pods"; // Adjust the import path as necessary
import { expect, describe, test } from "@jest/globals";

describe("namespace function", () => {
  test("should create a namespace object without labels if none are provided", () => {
    const result = namespace();
    expect(result).toEqual({
      apiVersion: "v1",
      kind: "Namespace",
      metadata: {
        name: "pepr-system",
      },
    });
    const result1 = namespace({ one: "two" });
    expect(result1).toEqual({
      apiVersion: "v1",
      kind: "Namespace",
      metadata: {
        name: "pepr-system",
        labels: {
          one: "two",
        },
      },
    });
  });

  test("should create a namespace object with empty labels if an empty object is provided", () => {
    const result = namespace({});
    expect(result.metadata.labels).toEqual({});
  });

  test("should create a namespace object with provided labels", () => {
    const labels = { "pepr.dev/controller": "admission", "istio-injection": "enabled" };
    const result = namespace(labels);
    expect(result.metadata.labels).toEqual(labels);
  });
});
