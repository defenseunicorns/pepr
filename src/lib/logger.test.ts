// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import test from "ava";

enum LogLevel {
  debug = "DEBUG",
  info = "INFO",
  warn = "WARN",
  error = "ERROR",
}

class Logger {
  constructor(private logLevel: LogLevel) {}

  private log(level: LogLevel, message: string): void {
    if (this.logLevel === LogLevel.debug || this.logLevel === level) {
      console.log(`${level}: ${message}`);
    }
  }

  public debug(message: string): void {
    this.log(LogLevel.debug, message);
  }

  public info(message: string): void {
    this.log(LogLevel.info, message);
  }

  public warn(message: string): void {
    this.log(LogLevel.warn, message);
  }

  public error(message: string): void {
    this.log(LogLevel.error, message);
  }
}

test("Logger debug logs correctly", t => {
  const logger = new Logger(LogLevel.debug);
  const message = "Debug message";
  const consoleLog = console.log;
  const consoleOutput: string[] = [];

  console.log = (output: string) => {
    consoleOutput.push(output);
  };

  logger.debug(message);

  t.is(consoleOutput.length, 1);
  t.true(consoleOutput[0].includes(LogLevel.debug));
  t.true(consoleOutput[0].includes(message));

  console.log = consoleLog;
});

test("Logger info logs correctly", t => {
  const logger = new Logger(LogLevel.info);
  const message = "Info message";
  const consoleLog = console.log;
  const consoleOutput: string[] = [];

  console.log = (output: string) => {
    consoleOutput.push(output);
  };

  logger.info(message);

  t.is(consoleOutput.length, 1);
  t.true(consoleOutput[0].includes(LogLevel.info));
  t.true(consoleOutput[0].includes(message));

  console.log = consoleLog;
});

test("Logger warn logs correctly", t => {
  const logger = new Logger(LogLevel.warn);
  const message = "Warning message";
  const consoleLog = console.log;
  const consoleOutput: string[] = [];

  console.log = (output: string) => {
    consoleOutput.push(output);
  };

  logger.warn(message);

  t.is(consoleOutput.length, 1);
  t.true(consoleOutput[0].includes(LogLevel.warn));
  t.true(consoleOutput[0].includes(message));

  console.log = consoleLog;
});

test("Logger error logs correctly", t => {
  const logger = new Logger(LogLevel.error);
  const message = "Error message";
  const consoleLog = console.log;
  const consoleOutput: string[] = [];

  console.log = (output: string) => {
    consoleOutput.push(output);
  };

  logger.error(message);

  t.is(consoleOutput.length, 1);
  t.true(consoleOutput[0].includes(LogLevel.error));
  t.true(consoleOutput[0].includes(message));

  console.log = consoleLog;
});