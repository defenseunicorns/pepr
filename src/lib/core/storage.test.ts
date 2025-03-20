// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { DataStore, Storage, v2StoreKey, v2UnescapedStoreKey, stripV2Prefix } from "./storage";
import fc from "fast-check";

describe("stripV2Prefix", () => {
  it("should remove the v2 prefix", () => {
    const keys = ["v2-key1", "v2-key2", "v2-key3", "v2-key4", "v2-key5"];
    const results = ["key1", "key2", "key3", "key4", "key5"];

    for (let i = 0; i < keys.length; i++) {
      const result = stripV2Prefix(keys[i]);
      expect(result).toEqual(results[i]);
    }
  });
});
describe("v2StoreKey", () => {
  it("should prefix the key with v2", () => {
    const keys = ["key1", "key2", "key3", "key4", "key5"];
    const results = ["v2-key1", "v2-key2", "v2-key3", "v2-key4", "v2-key5"];

    for (let i = 0; i < keys.length; i++) {
      const result = v2StoreKey(keys[i]);
      expect(result).toEqual(results[i]);
    }
  });
});

describe("v2UnescapedStoreKey", () => {
  it("should prefix the key with v2", () => {
    const keys = ["https://google.com", "sso-client-http://bin", "key3", "key4", "key5"];
    const results = [
      "v2-https://google.com",
      "v2-sso-client-http://bin",
      "v2-key3",
      "v2-key4",
      "v2-key5",
    ];

    for (let i = 0; i < keys.length; i++) {
      const result = v2UnescapedStoreKey(keys[i]);
      expect(result).toEqual(results[i]);
    }
  });
});
describe("Storage with fuzzing and property-based tests", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = new Storage();
    storage.registerSender(jest.fn());
  });

  it("should correctly set and retrieve items", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (key, value) => {
        storage.setItem(key, value);
        const mockData: DataStore = { [v2UnescapedStoreKey(key)]: value };
        storage.receive(mockData);
        if (value === "") {
          expect(storage.getItem(key)).toBeNull();
        } else {
          expect(storage.getItem(key)).toEqual(value);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("should return null for non-existing items", () => {
    fc.assert(
      fc.property(fc.string(), key => {
        expect(storage.getItem(key)).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it("should correctly remove items", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (key, value) => {
        storage.setItem(key, value);
        storage.removeItem(key);
        expect(storage.getItem(key)).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it("should ensure all set items are v2-coded internally", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (key, value) => {
        storage.setItem(key, value);
        const mockData: DataStore = { [v2UnescapedStoreKey(key)]: value };
        storage.receive(mockData);
        if (value === "") {
          expect(storage.getItem(key)).toBeNull();
        } else {
          expect(storage.getItem(key)).toEqual(value);
        }
      }),
      { numRuns: 100 },
    );
  });
});
describe("Storage", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = new Storage();
  });

  it("should set an item", () => {
    const mockSender = jest.fn();
    storage.registerSender(mockSender);
    const key = "key1";
    storage.setItem(key, "value1");

    expect(mockSender).toHaveBeenCalledWith("add", [v2UnescapedStoreKey(key)], "value1");
  });

  it("should set an item and wait", () => {
    const mockSender = jest.fn();
    storage.registerSender(mockSender);
    jest.useFakeTimers();
    const keys = ["key1", "https://google.com", "sso-client-http://bin"];

    keys.map(key => {
      void storage.setItemAndWait(key, "value1");
      expect(mockSender).toHaveBeenCalledWith("add", [v2StoreKey(key)], "value1");
    });

    jest.useRealTimers();
  });

  it("should remove an item and wait", () => {
    const mockSender = jest.fn();
    storage.registerSender(mockSender);
    jest.useFakeTimers();

    const key = "key1";
    // asserting on sender invocation rather than Promise so no need to wait
    void storage.removeItemAndWait(key);

    expect(mockSender).toHaveBeenCalledWith("remove", [v2StoreKey(key)], undefined);
    jest.useRealTimers();
  });

  it("should remove an item", () => {
    const mockSender = jest.fn();
    storage.registerSender(mockSender);
    const key = "key1";
    storage.removeItem(key);

    expect(mockSender).toHaveBeenCalledWith("remove", [v2StoreKey(key)], undefined);
  });

  it("should clear all items", () => {
    const mockSender = jest.fn();
    storage.registerSender(mockSender);

    storage.receive({ key1: "value1", key2: "value2", "sso-client-http://bin": "value3" });
    storage.clear();

    expect(mockSender).toHaveBeenCalledWith(
      "remove",
      ["key1", "key2", "sso-client-http:~1~1bin"],
      undefined,
    );
  });

  it("should get an item", () => {
    const keys = ["key1", "!", "!", "pepr", "https://google.com", "sftp://here:22", "!"];
    const results = [
      "value1",
      null,
      "!",
      "was-here",
      "3f7dd007-568f-4f4a-bbac-2e6bfff93860",
      "your-machine",
      " ",
    ];

    keys.map((key, i) => {
      const mockData: DataStore = { [v2UnescapedStoreKey(key)]: results[i]! };

      storage.receive(mockData);
      const value = storage.getItem(keys[i]);
      expect(value).toEqual(results[i]);
    });
  });

  it("should return null for non-existing item", () => {
    const value = storage.getItem("key1");

    expect(value).toBeNull();
  });

  it("should subscribe and unsubscribe", () => {
    const mockSubscriber = jest.fn();
    const unsubscribe = storage.subscribe(mockSubscriber);

    storage.receive({ key1: "value1" });

    expect(mockSubscriber).toHaveBeenCalledWith({ key1: "value1" });

    unsubscribe();

    storage.receive({ key2: "value2" });

    // Should not be called again after unsubscribe
    expect(mockSubscriber).toHaveBeenCalledTimes(1);
  });

  it("should call onReady handlers", () => {
    const mockReadyHandler = jest.fn();

    storage.onReady(mockReadyHandler);
    storage.receive({ key1: "value1" });

    expect(mockReadyHandler).toHaveBeenCalledWith({ key1: "value1" });
  });

  it("should handle null data in receive method", () => {
    const mockSubscriber = jest.fn();
    storage.subscribe(mockSubscriber);

    storage.receive(null as unknown as DataStore);

    expect(mockSubscriber).toHaveBeenCalledWith({});
  });
});
