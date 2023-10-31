// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { check } from "prettier";
import { PeprStore } from "./storage";
import { K8s, kind } from "kubernetes-fluent-client";

type Unit = "seconds" | "second" | "minute" | "minutes" | "hours" | "hour";
const STORE = 'schedule-secret'
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
  run: (() => void);
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
  run!: (() => void);
  startTime?: Date | undefined;
  duration: number | undefined;
  key: string;
  lastTimestamp: Date | undefined;

  constructor(schedule: ISchedule) {
    this.store = schedule.store;
    this.run = schedule.run;
    this.key = this.run.toString().slice(0, 20).replace(/\s+/g, ' ').replace(/\s/g, '').trim()
    this.every = schedule.every;
    this.unit = schedule.unit;
    this.startTime = schedule?.startTime;
    this.completions = schedule?.completions;

    this.startInterval();
  }

  startInterval() {
    this.checkStore()
    this.getDuration();
    this.setupInterval();
  }
  /**
   * checks the store for this schedule and sets the values if it exists
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

  private saveToStore() {
    const schedule = {
      completions: this.completions,
      startTime: this.startTime,
    };
    this.store.setItem(this.key, JSON.stringify(schedule))
  }

  private getDuration() {
    switch (this.unit) {
      case "seconds":
        if(this.every < 10) throw new Error("10 Seconds in the smallest interval allowed")
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

  private setupInterval() {
    if (this.startTime) {
      const now = new Date();
      const startTime = new Date(this.startTime);
      const delay = startTime.getTime() - now.getTime();
      if (delay > 0) {
        setTimeout(() => this.start(), delay);
      } else {
        this.start();
      }
    } else {
      this.start();
    }
  }



  private start() {
    this.intervalId = setInterval(() => {

      if (this.completions === 0) {
        this.stop();
      }

      try {
        this.run ? this.run() : undefined;
      } catch(err){
        console.error(err)
      }


      if (this.completions && this.completions !== 0) {
        this.completions -= 1;
      }
      this.saveToStore();
    }, this.duration);
  }

  private stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.store.removeItem(this.key) 
  }
}
