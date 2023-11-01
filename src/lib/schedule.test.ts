// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { beforeEach, describe, expect, it, jest, afterEach } from "@jest/globals";
import { OnSchedule, ISchedule } from './schedule';
import { PeprStore, Storage, DataReceiver, Unsubscribe } from "./storage";
import { on } from "events";

export class MockStorage {
    private storage: Record<string, string> = {};

    getItem(key: string): string | null {
        return this.storage[key] || null;
    }

    setItem(key: string, value: string): void {
        this.storage[key] = value;
    }

    removeItem(key: string): void {
        delete this.storage[key];
    }

    clear(): void {
        this.storage = {};
    }

    subscribe(): Unsubscribe {
        return true as unknown as Unsubscribe;
    }

    onReady(): void {
        return;
    }
}



describe('OnSchedule', () => {

    const mockSchedule: ISchedule = {
        store: new MockStorage(),
        every: 1,
        unit: 'minutes',
        run: jest.fn(),
    };

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should create an instance of OnSchedule', () => {
        const onSchedule = new OnSchedule(mockSchedule);
        expect(onSchedule).toBeInstanceOf(OnSchedule);
    });

    it('should start the interval and call the run method', () => {
        const onSchedule = new OnSchedule(mockSchedule);
        jest.useFakeTimers();

        onSchedule.startInterval();

        jest.advanceTimersByTime(60000);

        expect(mockSchedule.run).toHaveBeenCalled();
        jest.useRealTimers(); // Restore real timers
    });

    it('should stop the interval', () => {
        const onSchedule = new OnSchedule(mockSchedule);
        jest.useFakeTimers();
        const removeItemSpy = jest.spyOn(mockSchedule.store, 'removeItem');
        onSchedule.startInterval();
        onSchedule.stop();

        expect(onSchedule.intervalId).toBeNull();
        expect(removeItemSpy).toHaveBeenCalled();
        jest.useRealTimers();
    });

    it('should getDuration for seconds', () => {
        // test seconds
        mockSchedule.every = 10;
        mockSchedule.unit = 'seconds';
        const onSchedule = new OnSchedule(mockSchedule);
        onSchedule.getDuration();
        expect(onSchedule.duration).toBe(10000);

        // test error less than 10 seconds
        mockSchedule.every = 1;
        try {
            onSchedule.getDuration();
        } catch (e) {
            expect(e).toEqual(new Error("10 Seconds in the smallest interval allowed"));
        }

        // test minutes
        onSchedule.unit = 'minutes';
        onSchedule.getDuration();
        expect(onSchedule.duration).toBe(600000);

        // test hours
        onSchedule.unit = 'hours';
        onSchedule.getDuration();
        expect(onSchedule.duration).toBe(36000000);

        // test invalid unit
        onSchedule.unit = 'second';
        try {
            onSchedule.getDuration();
        } catch (e) {
            expect(e).toEqual(new Error("Invalid time unit"));
        }

    });

    it('should setupInterval', () => {
        // startTime and lastTimestamp should set startTime to undefined
        mockSchedule.startTime = new Date();
        mockSchedule.unit = 'seconds';
        mockSchedule.every = 10;
        const onSchedule = new OnSchedule(mockSchedule);
        onSchedule.lastTimestamp = new Date();
        onSchedule.setupInterval();
        expect(onSchedule.startTime).toBeUndefined();
    });

    it('should call setTimeout when delay is greater than 0', () => {

        const onSchedule = new OnSchedule(mockSchedule);
        onSchedule.startTime = new Date(new Date().getTime() + 10000)
        onSchedule.completions = 0;
        
            // Mock setTimeout to capture the callback function
            const setTimeoutMock = jest.spyOn(global, 'setTimeout');
        

            onSchedule.setupInterval();

        
            // Ensure that setTimeout was called with the correct parameters
            expect(setTimeoutMock).toHaveBeenCalled();
            expect(setTimeoutMock).toHaveBeenCalledWith(expect.any(Function), 10000);
  
        


      });

});
