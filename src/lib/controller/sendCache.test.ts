import { describe, expect, it } from "@jest/globals";
import { fillCache, flushCache } from "./sendCache";
import { Operation } from "fast-json-patch";

describe("sendCache", () => {
  describe("when removing entries)", () => {
    it("should clear the cache", async () => {
      const input: Record<string, Operation> = {
        entry: { op: "remove", path: "/some/path" },
        entry2: { op: "add", path: "some/path", value: "value" },
      };
      const result = await flushCache(input, "some namespace", "some name");
      expect(result).toStrictEqual({ entry: undefined, entry2: undefined });
    });
  });

  describe("when adding entries)", () => {
    it("should write to the cache", () => {
      const input: Record<string, Operation> = {
        "add:/data/capability-key:value": { op: "add", path: "/data/capability-key", value: "value" },
      };
      const result = fillCache({}, "capability", "add", ["key"], "value");
      expect(result).toStrictEqual(input);
    });

    it("should write undefined values as empty-string", () => {
      const input: Record<string, Operation> = {
        "add:/data/capability-key:": { op: "add", path: "/data/capability-key", value: "" },
      };
      const result = fillCache({}, "capability", "add", ["key"], undefined);
      expect(result).toStrictEqual(input);
    });
  });
});
