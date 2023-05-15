// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import test from "ava";
import { LogLevel, Logger } from "./logger.js";

test("Logger debug logs correctly", t => {
  const logger = new Logger(LogLevel.debug); // Create a logger with debug level
  const message = "Debug message";
  const consoleLog = console.log; // Store the original console.log function
  const consoleOutput: string[] = [];

  // Replace console.log with a mock function to capture the output
  console.log = (output: string) => {
    consoleOutput.push(output);
  };

  logger.debug(message); // Call the debug method

  // Check that the output matches the expected value
  t.true(consoleOutput[0].includes(LogLevel[LogLevel.debug]));
  t.true(consoleOutput[0].includes(message));

  // Restore the original console.log function
  console.log = consoleLog;
});

test("Logger info logs correctly", t => {
  const logger = new Logger(LogLevel.info); // Create a logger with info level
  const message = "Info message";
  const consoleLog = console.log;
  const consoleOutput: string[] = [];

  console.log = (output: string) => {
    consoleOutput.push(output);
  };

  logger.info(message);

  t.true(consoleOutput[0].includes(LogLevel[LogLevel.info]));
  t.true(consoleOutput[0].includes(message));

  console.log = consoleLog;
});

test("Logger warn logs correctly", t => {
  const logger = new Logger(LogLevel.warn); // Create a logger with warn level
  const message = "Warning message";
  const consoleLog = console.log;
  const consoleOutput: string[] = [];

  console.log = (output: string) => {
    consoleOutput.push(output);
  };

  logger.warn(message);

  t.true(consoleOutput[0].includes(LogLevel[LogLevel.warn]));
  t.true(consoleOutput[0].includes(message));

  console.log = consoleLog;
});

test("Logger error logs correctly", t => {
  const logger = new Logger(LogLevel.error); // Create a logger with error level
  const message = "Error message";
  const consoleLog = console.log;
  const consoleOutput: string[] = [];

  console.log = (output: string) => {
    consoleOutput.push(output);
  };

  logger.error(message);

  t.true(consoleOutput[0].includes(LogLevel[LogLevel.error]));
  t.true(consoleOutput[0].includes(message));

  console.log = consoleLog;
});
