// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { expect, it, describe, vi } from "vitest";
import { convertToBase64Map, convertFromBase64Map, base64Decode, base64Encode } from "./utils";

vi.mock("./telemetry/logger", () => ({
  __esModule: true,
  default: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe("utils", () => {
  it("convertToBase64Map should encode all ascii values and skip listed values in skip array", () => {
    const obj = {
      data: {
        test1: "test1",
        test2: "test2",
        test3: "test3",
        test4: "test4",
      },
    };
    const skip = ["test2", "test4"];
    convertToBase64Map(obj, skip);
    expect(obj.data["test1"]).toBe(base64Encode("test1"));
    expect(obj.data["test2"]).toBe("test2");
    expect(obj.data["test3"]).toBe(base64Encode("test3"));
    expect(obj.data["test4"]).toBe("test4");
  });

  it("convertFromBase64Map should decode all ascii values and skip values in skip array", () => {
    const obj = {
      data: {
        test1: base64Encode("test1"),
        test2: "test2",
        test3: base64Encode("test3"),
        test4: "test4",
        test5: undefined as unknown as string,
      },
    };
    const skip = convertFromBase64Map(obj);
    expect(obj.data["test1"]).toBe("test1");
    expect(obj.data["test2"]).toBe("test2");
    expect(obj.data["test3"]).toBe("test3");
    expect(obj.data["test4"]).toBe("test4");
    expect(skip).toEqual(["test2", "test4"]);
    expect(obj.data["test5"]).toBe("");
  });

  it("base64Decode should decode a base64 string", () => {
    const data = "dGVzdDE=";
    expect(base64Decode(data)).toBe("test1");
  });

  it("base64Encode should encode a string to base64", () => {
    const data = "test1";
    expect(base64Encode(data)).toBe("dGVzdDE=");
  });

  it("convertToBase64Map empty object", () => {
    const obj = {};
    const objOut = { data: {} };
    convertToBase64Map(obj, []);
    expect(obj).toStrictEqual(objOut);
  });

  it("convertFromBase64Map empty object", () => {
    const obj = {};
    const objOut = { data: {} };
    const skip = convertFromBase64Map(obj);
    expect(obj).toStrictEqual(objOut);
    expect(skip).toEqual([]);
  });
});
// Path: src/lib/utils.ts
