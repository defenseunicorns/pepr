// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { DataStore, Storage } from "./storage";

describe("Storage", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = new Storage();
  });

  it("should set an item", () => {
    const mockSender = jest.fn();
    storage.registerSender(mockSender);

    storage.setItem("key1", "value1");

    expect(mockSender).toHaveBeenCalledWith("add", ["key1"], "value1");
  });

  it("should set an item and wait", () => {
    const mockSender = jest.fn();
    storage.registerSender(mockSender);
    jest.useFakeTimers();

    // asserting on sender invocation rather than Promise so no need to wait
    void storage.setItemAndWait("key1", "value1");

    expect(mockSender).toHaveBeenCalledWith("add", ["key1"], "value1");
    jest.useRealTimers();
  });

  it("should remove an item", () => {
    const mockSender = jest.fn();
    storage.registerSender(mockSender);

    storage.removeItem("key1");

    expect(mockSender).toHaveBeenCalledWith("remove", ["key1"], undefined);
  });

  it("should clear all items", () => {
    const mockSender = jest.fn();
    storage.registerSender(mockSender);

    storage.receive({ key1: "value1", key2: "value2" });
    storage.clear();

    expect(mockSender).toHaveBeenCalledWith("remove", ["key1", "key2"], undefined);
  });

  it("should get an item", () => {
    const mockData: DataStore = { key1: "value1" };
    storage.receive(mockData);

    const value = storage.getItem("key1");

    expect(value).toEqual("value1");
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
