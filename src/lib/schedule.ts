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
  store: Storage;
  completions?: number;
  every: number;
  unit: Unit;
  run: () => void;
  startTime?: Date;
  duration: number = 0;

  constructor(schedule: ISchedule) {
    this.store = schedule.store;
    this.run = schedule.run;

    this.every = schedule.every;
    this.unit = schedule.unit;
    this.startTime = schedule?.startTime;
    this.completions = schedule?.completions;

    // Run the schedule 
    this.checkStore();
    this.getDuration();
    this.setupInterval();
  }

  /**
   * checks the store for this schedule and sets the values if it exists
   * @returns
   */
  private checkStore() {
    const result = this.store.getItem(this.run.toString().slice(0,20));
    if (result !== null) {
        // careful not to override the values if they are already set and store is null
      const storedSchedule = JSON.parse(result);
      this.completions = storedSchedule?.completions || undefined;
      this.startTime = storedSchedule?.startTime || undefined;
      this.every = storedSchedule?.every;
      this.run = storedSchedule?.run;
      this.unit = storedSchedule?.unit;
    }
  }

  private saveToStore() {
    const schedule = {
      completions: this.completions,
      startTime: this.startTime,
      every: this.every,
      run: this.run,
      unit: this.unit,
    };
    this.store.setItem(this.run.toString().slice(0,20), JSON.stringify(schedule));
  }

  private getDuration() {
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
  }

  private recordInterval() {
    this.store.setItem(this.run.toString().slice(0,20), JSON.stringify(this));
  }

  private start() {
    this.intervalId = setInterval(() => {
      this.run();
      if(this.completions !== undefined && this.completions !== 0) {
        this.completions -= 1;
      }

      this.recordInterval();

      if (this.completions === 0) {
        this.stop();
      }
      
    }, this.duration);
  }

  private stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.store.removeItem(this.run.toString().slice(0,20));
    }
  }
}
