// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { OnSchedule, Schedule, Unit } from "./schedule";
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
    run: vi.fn(),
  };

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.clearAllTimers();
    vi.resetModules();
  });

  beforeEach(() => {
    vi.useFakeTimers();
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
    vi.advanceTimersByTime(100000);

    const secondSchedule = new OnSchedule(mockSchedule);
    onSchedule.setStore(new MockStorage());
    secondSchedule.completions = 9;
    secondSchedule.duration = 1;
    secondSchedule.start();
    vi.advanceTimersByTime(100000);
    expect(secondSchedule.completions).toBe(0);
    vi.runOnlyPendingTimers();
    vi.clearAllTimers();
  });

  it("should stop, removeItem, and removeItem", () => {
    const onSchedule = new OnSchedule(mockSchedule);
    onSchedule.setStore(new MockStorage());
    const removeItemSpy = vi.spyOn(onSchedule.store as MockStorage, "removeItem");

    onSchedule.startInterval();
    onSchedule.stop();

    expect(onSchedule.intervalId).toBeNull();
    expect(removeItemSpy).toHaveBeenCalled();

    onSchedule.intervalId = 9 as unknown as NodeJS.Timeout;
    onSchedule.stop();
    expect(onSchedule.intervalId).toBeNull();
    vi.runOnlyPendingTimers();
    vi.clearAllTimers();
  });

  describe("getDuration handles supported inputs", () => {
    it.each([
      {
        description: "test seconds",
        setup: { every: 10, unit: "seconds" },
        expectedDuration: 10000,
        shouldThrow: false,
      },
      {
        description: "test second error",
        setup: { every: 8, unit: "seconds" },
        expectedError: new Error("10 Seconds in the smallest interval allowed"),
        shouldThrow: true,
      },
      {
        description: "test minutes",
        setup: { every: 10, unit: "minutes" },
        expectedDuration: 600000,
        shouldThrow: false,
      },
      {
        description: "test singular minute",
        setup: { every: 10, unit: "minute" },
        expectedDuration: 600000,
        shouldThrow: false,
      },
      {
        description: "test hours",
        setup: { every: 10, unit: "hours" },
        expectedDuration: 36000000,
        shouldThrow: false,
      },
      {
        description: "test singular hour",
        setup: { every: 10, unit: "hour" },
        expectedDuration: 36000000,
        shouldThrow: false,
      },
      {
        description: "test invalid unit",
        setup: { every: 10, unit: "second" },
        expectedError: new Error("Invalid time unit"),
        shouldThrow: true,
      },
    ])("%p", ({ description, setup, expectedDuration, expectedError, shouldThrow }) => {
      const mockSchedule: Schedule = {
        name: description,
        every: setup.every,
        unit: setup.unit as Unit,
        run: vi.fn(),
      };
      const onSchedule = new OnSchedule(mockSchedule);

      if (shouldThrow) {
        expect(() => onSchedule.getDuration()).toThrow(expectedError);
      } else {
        onSchedule.getDuration();
        expect(onSchedule.duration).toBe(expectedDuration);
      }
    });
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

    const setItemSpy = vi.spyOn(onSchedule.store as MockStorage, "setItem");
    onSchedule.saveToStore();
    expect(setItemSpy).toHaveBeenCalledTimes(1);
  });
  it("checkStore retrieves values from the store", () => {
    mockSchedule.run = (): void => {};
    const onSchedule = new OnSchedule(mockSchedule);
    onSchedule.setStore(new MockStorage());
    const getItemSpy = vi.spyOn(onSchedule.store as MockStorage, "getItem");
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
