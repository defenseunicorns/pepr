// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Storage } from "./storage";

export enum Unit {
  Second = "seconds",
  Minute = "minutes",
  Hour = "hours",
}

export interface ISchedule {
  /**
   * Storage for tracking schedule operations
   */
  store: Storage;
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
  startTime?: Date;
  /**
   * The start time of the schedule
   */
  stopTime?: Date;
  /**
   * The number of times the schedule has run
   */
  completions?: number;
  /**
   * Tje intervalID to clear the interval
   */
  intervalID?: NodeJS.Timeout;
}

export class OnSchedule implements ISchedule {
  private intervalId: NodeJS.Timeout | null = null;
  store: Storage;
  completions?: number;
  every: number;
  unit: Unit;
  run: () => void;
  startTime?: Date;
  stopTime?: Date;
  duration: number = 0;

  constructor(schedule: ISchedule) {
    // only run in WatchController
    // if (process.env.PEPR_WATCH_MODE === "true") {
    this.store = schedule.store;
    this.run = schedule.run;

    this.every = schedule.every;
    this.unit = schedule.unit;
    this.startTime = schedule?.startTime;
    this.stopTime = schedule?.stopTime;
    this.completions = schedule?.completions ?? 0;

    // check store for existing schedule with same name
    this.checkStore();
    this.getDuration();
    this.setupInterval();
    // }
  }

  /**
   * checks the store for this schedule and sets the values if it exists
   * @returns
   */
  private checkStore() {
    const result = this.store.getItem(this.run.toString());
    if (result !== null) {
      const parsedResult = JSON.parse(result);
      this.completions = parsedResult.completions;
      this.startTime = parsedResult.startTime;
      this.stopTime = parsedResult.stopTime;
      this.every = parsedResult.every;
      this.run = parsedResult.run;
      this.unit = parsedResult.unit;
    }
  }

  private saveToStore() {}
  private getDuration() {
    // find milliseconds for the unit

    switch (this.unit) {
      case "seconds":
        this.duration = 1000;
        break;
      case "minutes":
        this.duration = 1000 * 60;
        break;
      case "hours":
        this.duration = 1000 * 60 * 60;
        break;
      default:
        throw new Error("Invalid time unit");
    }
  }
  private setupInterval() {
    // set timeout to run Interval is startTime is > now
    if (this.startTime !== undefined) {
      const now = new Date();
      const startTime = new Date(this.startTime);
      const delay = startTime.getTime() - now.getTime();
      if (delay > 0) {
        setTimeout(() => this.start(), delay);
      } else {
        this.start();
      }
    }

    // store schedule info in store
  }

  private recordInterval() {
    if (this.completions !== -1) {
      this.getDuration();
    }
    if (this.stopTime !== undefined) {
      const now = new Date();
      const stopTime = new Date(this.stopTime);
      if (now.getTime() >= stopTime.getTime()) {
        this.stop();
      }
    }
  }

  private start() {
    this.intervalId = setInterval(() => {
      this.run();
    }, this.duration);
  }

  private stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.store.removeItem(this.run.toString());
    }
  }
}
