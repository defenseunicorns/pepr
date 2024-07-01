// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { base64Encode } from "./utils";
import { DataStore, Storage } from "./storage";
import fc from "fast-check";

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
        const encodedKey = base64Encode(key);
        const mockData: DataStore = { [encodedKey]: value };
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

  it("should ensure all set items are base64 encoded internally", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (key, value) => {
        storage.setItem(key, value);
        const encodedKey = base64Encode(key);
        const mockData: DataStore = { [encodedKey]: value };
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
    const encodedKey = base64Encode(key);
    storage.setItem("key1", "value1");

    expect(mockSender).toHaveBeenCalledWith("add", [encodedKey], "value1");
  });

  it("should set an item and wait", () => {
    const mockSender = jest.fn();
    storage.registerSender(mockSender);
    jest.useFakeTimers();
    const key = "key1";
    const encodedKey = base64Encode(key);
    // asserting on sender invocation rather than Promise so no need to wait
    void storage.setItemAndWait(key, "value1");

    expect(mockSender).toHaveBeenCalledWith("add", [encodedKey], "value1");
    jest.useRealTimers();
  });

  it("should remove an item and wait", () => {
    const mockSender = jest.fn();
    storage.registerSender(mockSender);
    jest.useFakeTimers();

    const key = "key1";
    const encodedKey = base64Encode(key);
    // asserting on sender invocation rather than Promise so no need to wait
    void storage.removeItemAndWait(key);

    expect(mockSender).toHaveBeenCalledWith("remove", [encodedKey], undefined);
    jest.useRealTimers();
  });

  it("should remove an item", () => {
    const mockSender = jest.fn();
    storage.registerSender(mockSender);
    const key = "key1";
    const encodedKey = base64Encode(key);
    storage.removeItem(key);

    expect(mockSender).toHaveBeenCalledWith("remove", [encodedKey], undefined);
  });

  it("should clear all items", () => {
    const mockSender = jest.fn();
    storage.registerSender(mockSender);

    storage.receive({ key1: "value1", key2: "value2" });
    storage.clear();

    expect(mockSender).toHaveBeenCalledWith("remove", ["key1", "key2"], undefined);
  });

  it("should get an item", () => {
    const keys = ["key1", "!", "!", "pepr", "https://google.com", "sftp://here:22", "!"];
    const results = ["value1", null, "!", "was-here", "3f7dd007-568f-4f4a-bbac-2e6bfff93860", "your-machine", " "];

    keys.map((key, i) => {
      const mockData: DataStore = { [base64Encode(key!)]: results[i]! };

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
