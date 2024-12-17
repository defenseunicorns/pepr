// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeEach, describe, expect, it, jest, afterEach } from "@jest/globals";
import { OnSchedule, Schedule } from "./schedule";
import { Unsubscribe } from "./storage";

export class MockStorage {
  private storage: Record<string, string> = {};
  subscription: string;
  constructor() {
    this.subscription = "";
  }

  getItem(key: string): string | null {
    return this.storage[key] || null;
  }

  setItem(key: string, value: string): void {
    this.storage[key] = value;
  }

  setItemAndWait(key: string, value: string): Promise<string> {
    return new Promise(resolve => {
      this.storage[key] = value;
      resolve("ok");
    });
  }

  removeItem(key: string): void {
    delete this.storage[key];
  }

  removeItemAndWait(key: string): Promise<string> {
    return new Promise(resolve => {
      delete this.storage[key];
      resolve("ok");
    });
  }

  clear(): void {
    this.storage = {};
  }

  subscribe(): Unsubscribe {
    // Expected 'this' to be used by class method 'subscribe'
    this.subscription = "";
    return true as unknown as Unsubscribe;
  }

  onReady(): void {
    // Expected 'this' to be used by class method 'onReady'
    this.subscription = "";
    return;
  }
}

describe("OnSchedule", () => {
  const mockSchedule: Schedule = {
    name: "test",
    every: 1,
    unit: "minutes",
    run: jest.fn(),
  };

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    jest.clearAllTimers();
    jest.resetModules();
  });

  beforeEach(() => {
    jest.useFakeTimers();
  });

  it("should create an instance of OnSchedule", () => {
    const onSchedule = new OnSchedule(mockSchedule);
    onSchedule.setStore(new MockStorage());
    expect(onSchedule).toBeInstanceOf(OnSchedule);
  });

  it("should startInterval, run, and start", () => {
    const onSchedule = new OnSchedule(mockSchedule);
    onSchedule.setStore(new MockStorage());
    onSchedule.completions = 0;

    onSchedule.start();

    onSchedule.startTime = new Date(new Date().getTime() + 100000);

    onSchedule.setupInterval();
    jest.advanceTimersByTime(100000);

    const secondSchedule = new OnSchedule(mockSchedule);
    onSchedule.setStore(new MockStorage());
    secondSchedule.completions = 9;
    secondSchedule.duration = 1;
    secondSchedule.start();
    jest.advanceTimersByTime(100000);
    expect(secondSchedule.completions).toBe(0);
    jest.runOnlyPendingTimers();
    jest.clearAllTimers();
  });

  it("should stop, removeItem, and removeItem", () => {
    const onSchedule = new OnSchedule(mockSchedule);
    onSchedule.setStore(new MockStorage());
    const removeItemSpy = jest.spyOn(onSchedule.store as MockStorage, "removeItem");

    onSchedule.startInterval();
    onSchedule.stop();

    expect(onSchedule.intervalId).toBeNull();
    expect(removeItemSpy).toHaveBeenCalled();

    onSchedule.intervalId = 9 as unknown as NodeJS.Timeout;
    onSchedule.stop();
    expect(onSchedule.intervalId).toBeNull();
    jest.runOnlyPendingTimers();
    jest.clearAllTimers();
  });

  it("should getDuration", () => {
    // test second
    mockSchedule.every = 10;
    mockSchedule.unit = "seconds";
    const onSchedule = new OnSchedule(mockSchedule);
    onSchedule.getDuration();
    expect(onSchedule.duration).toBe(10000);

    // test second error
    mockSchedule.every = 8;
    try {
      onSchedule.getDuration();
    } catch (e) {
      expect(e).toEqual(new Error("10 Seconds in the smallest interval allowed"));
    }

    // test minute(s)
    onSchedule.unit = "minutes";
    onSchedule.getDuration();
    expect(onSchedule.duration).toBe(600000);
    onSchedule.unit = "minute";
    onSchedule.getDuration();
    expect(onSchedule.duration).toBe(600000);

    // test hour(s)
    onSchedule.unit = "hours";
    onSchedule.getDuration();
    expect(onSchedule.duration).toBe(36000000);
    onSchedule.unit = "hour";
    onSchedule.getDuration();
    expect(onSchedule.duration).toBe(36000000);

    // test invalid unit
    onSchedule.unit = "second";
    try {
      onSchedule.getDuration();
    } catch (e) {
      expect(e).toEqual(new Error("Invalid time unit"));
    }
  });

  it("should setupInterval", () => {
    // startTime and lastTimestamp should set startTime to undefined
    mockSchedule.startTime = new Date();
    mockSchedule.unit = "seconds";
    mockSchedule.every = 10;
    const onSchedule = new OnSchedule(mockSchedule);
    onSchedule.setStore(new MockStorage());
    onSchedule.lastTimestamp = new Date();
    onSchedule.setupInterval();
    expect(onSchedule.startTime).toBeUndefined();
  });

  it("should call setItem during saveToStore", () => {
    const onSchedule = new OnSchedule(mockSchedule);
    onSchedule.setStore(new MockStorage());

    const setItemSpy = jest.spyOn(onSchedule.store as MockStorage, "setItem");
    onSchedule.saveToStore();
    expect(setItemSpy).toHaveBeenCalledTimes(1);
  });
  it("checkStore retrieves values from the store", () => {
    mockSchedule.run = () => {};
    const onSchedule = new OnSchedule(mockSchedule);
    onSchedule.setStore(new MockStorage());
    const getItemSpy = jest.spyOn(onSchedule.store as MockStorage, "getItem");
    const startTime = "doesn't";
    const lastTimestamp = "matter";
    getItemSpy.mockReturnValue(
      JSON.stringify({
        completions: 1,
        startTime,
        lastTimestamp,
      }),
    );
    onSchedule.checkStore();

    expect(getItemSpy).toHaveBeenCalledTimes(1);

    // // Verify that the values were correctly retrieved and assigned
    expect(onSchedule.completions).toBe(1);
    expect(onSchedule.startTime).toEqual(startTime);
    expect(onSchedule.lastTimestamp).toEqual(lastTimestamp);

    getItemSpy.mockReturnValue(
      JSON.stringify({
        lastTimestamp: undefined,
      }),
    );
    onSchedule.checkStore();

    expect(onSchedule.lastTimestamp).toEqual(undefined);
  });
});
