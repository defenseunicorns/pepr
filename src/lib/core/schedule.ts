// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { PeprStore } from "./storage";

export type Unit = "seconds" | "second" | "minute" | "minutes" | "hours" | "hour";

export interface Schedule {
  /**
   * * The name of the store
   */
  name: string;
  /**
   * The value associated with a unit of time
   */
  every: number;
  /**
   * The unit of time
   */
  unit: Unit;
  /**
   * The code to run
   */
  run: () => void;
  /**
   * The start time of the schedule
   */
  startTime?: Date | undefined;

  /**
   * The number of times the schedule has run
   */
  completions?: number | undefined;
  /**
   * Tje intervalID to clear the interval
   */
  intervalID?: NodeJS.Timeout;
}

export class OnSchedule implements Schedule {
  intervalId: NodeJS.Timeout | null = null;
  store: PeprStore | undefined;
  name!: string;
  completions?: number | undefined;
  every: number;
  unit: Unit;
  run!: () => void;
  startTime?: Date | undefined;
  duration: number | undefined;
  lastTimestamp: Date | undefined;

  constructor(schedule: Schedule) {
    this.name = schedule.name;
    this.run = schedule.run;
    this.every = schedule.every;
    this.unit = schedule.unit;
    this.startTime = schedule?.startTime;
    this.completions = schedule?.completions;
  }
  setStore(store: PeprStore): void {
    this.store = store;
    this.startInterval();
  }
  startInterval(): void {
    this.checkStore();
    this.getDuration();
    this.setupInterval();
  }
  /**
   * Checks the store for this schedule and sets the values if it exists
   * @returns
   */
  checkStore(): void {
    const result = this.store && this.store.getItem(this.name);
    if (result) {
      const storedSchedule = JSON.parse(result);
      this.completions = storedSchedule?.completions;
      this.startTime = storedSchedule?.startTime;
      this.lastTimestamp = storedSchedule?.lastTimestamp;
    }
  }

  /**
   * Saves the schedule to the store
   * @returns
   */
  saveToStore(): void {
    const schedule = {
      completions: this.completions,
      startTime: this.startTime,
      lastTimestamp: new Date(),
      name: this.name,
    };
    if (this.store) this.store.setItem(this.name, JSON.stringify(schedule));
  }

  /**
   * Gets the durations in milliseconds
   */
  getDuration(): void {
    switch (this.unit) {
      case "seconds":
        if (this.every < 10) throw new Error("10 Seconds in the smallest interval allowed");
        this.duration = 1000 * this.every;
        break;
      case "minutes":
      case "minute":
        this.duration = 1000 * 60 * this.every;
        break;
      case "hours":
      case "hour":
        this.duration = 1000 * 60 * 60 * this.every;
        break;
      default:
        throw new Error("Invalid time unit");
    }
  }

  /**
   * Sets up the interval
   */
  setupInterval(): void {
    const now = new Date();
    let delay: number | undefined;

    if (this.lastTimestamp && this.startTime) {
      this.startTime = undefined;
    }

    if (this.startTime) {
      delay = this.startTime.getTime() - now.getTime();
    } else if (this.lastTimestamp && this.duration) {
      const lastTimestamp = new Date(this.lastTimestamp);
      delay = this.duration - (now.getTime() - lastTimestamp.getTime());
    }

    if (delay === undefined || delay <= 0) {
      this.start();
    } else {
      setTimeout(() => {
        this.start();
      }, delay);
    }
  }

  /**
   * Starts the interval
   */
  start(): void {
    this.intervalId = setInterval(() => {
      if (this.completions === 0) {
        this.stop();
        return;
      } else {
        this.run();

        if (this.completions && this.completions !== 0) {
          this.completions -= 1;
        }
        this.saveToStore();
      }
    }, this.duration);
  }

  /**
   * Stops the interval
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.store) this.store.removeItem(this.name);
  }
}
