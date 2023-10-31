// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { PeprStore } from "./storage";

type Unit = "seconds" | "second" | "minute" | "minutes" | "hours" | "hour";

export interface ISchedule {
  /**
   * Storage for tracking schedule operations
   */
  store: PeprStore;
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

export class OnSchedule implements ISchedule {
  private intervalId: NodeJS.Timeout | null = null;
  store: PeprStore;
  completions?: number | undefined;
  every: number;
  unit: Unit;
  run!: () => void;
  startTime?: Date | undefined;
  duration: number | undefined;
  key: string;
  lastTimestamp: Date | undefined;

  constructor(schedule: ISchedule) {
    this.store = schedule.store;
    this.run = schedule.run;
    this.key = this.run.toString().slice(0, 20).replace(/\s+/g, " ").replace(/\s/g, "").trim();
    this.every = schedule.every;
    this.unit = schedule.unit;
    this.startTime = schedule?.startTime;
    this.completions = schedule?.completions;

    this.startInterval();
  }

  startInterval() {
    this.checkStore();
    this.getDuration();
    this.setupInterval();
  }
  /**
   * Checks the store for this schedule and sets the values if it exists
   * @returns
   */
  checkStore() {
    const result = this.store.getItem(this.key);
    if (result) {
      const storedSchedule = JSON.parse(result);
      this.completions = storedSchedule?.completions || undefined;
      this.startTime = storedSchedule?.startTime || undefined;
      this.lastTimestamp = storedSchedule?.lastTimestamp || undefined;
    }
  }

  /**
   * Saves the schedule to the store
   * @returns
   */
  private saveToStore() {
    const schedule = {
      completions: this.completions,
      startTime: this.startTime,
      lastTimestamp: new Date(),
    };
    this.store.setItem(this.key, JSON.stringify(schedule));
  }

  /**
   * Gets the durations in milliseconds
   */
  private getDuration() {
    switch (this.unit) {
      case "seconds":
        if (this.every < 10) throw new Error("10 Seconds in the smallest interval allowed");
        this.duration = 1000 * this.every;
        break;
      case "minutes" || "minute":
        this.duration = 1000 * 60 * this.every;
        break;
      case "hours" || "hour":
        this.duration = 1000 * 60 * 60 * this.every;
        break;
      default:
        throw new Error("Invalid time unit");
    }
  }

  /**
   * Sets up the interval
   */
  private setupInterval() {
    const now = new Date();
    let delay: number | undefined;

    if (this.lastTimestamp && this.startTime) {
      this.startTime = undefined;
    }

    if (this.startTime) {
      const startTime = new Date(this.startTime);
      delay = startTime.getTime() - now.getTime();
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
  private start() {
    this.intervalId = setInterval(() => {
      if (this.completions === 0) {
        this.stop();
      }

      try {
        this.run ? this.run() : undefined;
      } catch (err) {
        console.error(err);
      }

      if (this.completions && this.completions !== 0) {
        this.completions -= 1;
      }
      this.saveToStore();
    }, this.duration);
  }

  /**
   * Stops the interval
   */
  private stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.store.removeItem(this.key);
  }
}
