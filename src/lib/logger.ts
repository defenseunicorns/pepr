// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

/**
 * Enumeration representing different logging levels.
 */
export enum LogLevel {
  debug = 0,
  info = 1,
  warn = 2,
  error = 3,
}

enum ConsoleColors {
  Reset = "\x1b[0m",
  Bright = "\x1b[1m",
  Dim = "\x1b[2m",
  Underscore = "\x1b[4m",
  Blink = "\x1b[5m",
  Reverse = "\x1b[7m",
  Hidden = "\x1b[8m",

  FgBlack = "\x1b[30m",
  FgRed = "\x1b[31m",
  FgGreen = "\x1b[32m",
  FgYellow = "\x1b[33m",
  FgBlue = "\x1b[34m",
  FgMagenta = "\x1b[35m",
  FgCyan = "\x1b[36m",
  FgWhite = "\x1b[37m",

  BgBlack = "\x1b[40m",
  BgRed = "\x1b[41m",
  BgGreen = "\x1b[42m",
  BgYellow = "\x1b[43m",
  BgBlue = "\x1b[44m",
  BgMagenta = "\x1b[45m",
  BgCyan = "\x1b[46m",
  BgWhite = "\x1b[47m",
}

/**
 * Simple logger class that logs messages at different log levels.
 */
export class Logger {
  private _logLevel: LogLevel;

  /**
   * Create a new logger instance.
   * @param logLevel - The minimum log level to log messages for.
   */
  constructor(logLevel: LogLevel) {
    this._logLevel = logLevel;
  }

  /**
   * Change the log level of the logger.
   * @param logLevel - The log level to log the message at.
   */
  public SetLogLevel(logLevel: string): void {
    this._logLevel = LogLevel[logLevel as keyof typeof LogLevel];
    this.debug(`Log level set to ${logLevel}`);
  }

  /**
   * Log a debug message.
   * @param message - The message to log.
   */
  public debug<T>(message: T, prefix?: string): void {
    this.log(LogLevel.debug, message, prefix);
  }

  /**
   * Log an info message.
   * @param message - The message to log.
   */
  public info<T>(message: T, prefix?: string): void {
    this.log(LogLevel.info, message, prefix);
  }

  /**
   * Log a warning message.
   * @param message - The message to log.
   */
  public warn<T>(message: T, prefix?: string): void {
    this.log(LogLevel.warn, message, prefix);
  }

  /**
   * Log an error message.
   * @param message - The message to log.
   */
  public error<T>(message: T, prefix?: string): void {
    this.log(LogLevel.error, message, prefix);
  }

  /**
   * Log a message at the specified log level.
   * @param logLevel - The log level of the message.
   * @param message - The message to log.
   */
  private log<T>(logLevel: LogLevel, message: T, callerPrefix = ""): void {
    const color = {
      [LogLevel.debug]: ConsoleColors.FgBlack,
      [LogLevel.info]: ConsoleColors.FgCyan,
      [LogLevel.warn]: ConsoleColors.FgYellow,
      [LogLevel.error]: ConsoleColors.FgRed,
    };

    if (logLevel >= this._logLevel) {
      // Prefix the message with the colored log level.
      let prefix = "[" + LogLevel[logLevel] + "]\t" + callerPrefix;

      prefix = this.colorize(prefix, color[logLevel]);

      // If the message is not a string, use the debug method to log the object.
      if (typeof message !== "string") {
        console.log(prefix);
        console.debug("%o", message);
      } else {
        console.log(prefix + "\t" + message);
      }
    }
  }

  private colorize(text: string, color: ConsoleColors): string {
    return color + text + ConsoleColors.Reset;
  }
}

/** Log is an instance of Logger used to generate log entries. */
const Log = new Logger(LogLevel.info);
if (process.env.LOG_LEVEL) {
  Log.SetLogLevel(process.env.LOG_LEVEL);
}
export default Log;
