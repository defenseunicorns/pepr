import { describe, it, expect } from "vitest";
import { ModuleConfig } from "../types";
import { genEnv, getLogLevel } from "./environment";

describe("getLogLevel", () => {
  it("returns the log level from environment variable if set", () => {
    process.env.LOG_LEVEL = "debug";
    const config: ModuleConfig = { uuid: "12345", alwaysIgnore: { namespaces: [] } };
    const logLevel = getLogLevel(config);
    expect(logLevel).toBe("debug");
    delete process.env.LOG_LEVEL; // Clean up after test
  });

  it("returns the log level from config if environment variable is not set", () => {
    const config: ModuleConfig = {
      uuid: "12345",
      logLevel: "info",
      alwaysIgnore: { namespaces: [] },
    };
    const logLevel = getLogLevel(config);
    expect(logLevel).toBe("info");
  });
});

describe("genEnv", () => {
  it("generates default environment variables without watch mode", () => {
    const config: ModuleConfig = {
      uuid: "12345",
      alwaysIgnore: {
        namespaces: [],
      },
    };

    const expectedEnv = [
      { name: "PEPR_WATCH_MODE", value: "false" },
      { name: "PEPR_PRETTY_LOG", value: "false" },
      { name: "LOG_LEVEL", value: "info" },
    ];

    const result = genEnv(config);

    expect(result).toEqual(expectedEnv);
  });

  it("generates default environment variables with watch mode", () => {
    const config: ModuleConfig = {
      uuid: "12345",
      alwaysIgnore: {
        namespaces: [],
      },
    };

    const expectedEnv = [
      { name: "PEPR_WATCH_MODE", value: "true" },
      { name: "PEPR_PRETTY_LOG", value: "false" },
      { name: "LOG_LEVEL", value: "info" },
    ];

    const result = genEnv(config, true);

    expect(result).toEqual(expectedEnv);
  });

  it("overrides default environment variables with config.env", () => {
    const config: ModuleConfig = {
      uuid: "12345",
      logLevel: "debug",
      env: {
        CUSTOM_ENV_VAR: "custom_value",
      },
      alwaysIgnore: {
        namespaces: [],
      },
    };

    const expectedEnv = [
      { name: "PEPR_WATCH_MODE", value: "false" },
      { name: "PEPR_PRETTY_LOG", value: "false" },
      { name: "LOG_LEVEL", value: "debug" },
      { name: "CUSTOM_ENV_VAR", value: "custom_value" },
    ];

    const result = genEnv(config);

    expect(result).toEqual(expectedEnv);
  });

  it("handles empty config.env correctly", () => {
    const config: ModuleConfig = {
      uuid: "12345",
      logLevel: "error",
      env: {},
      alwaysIgnore: {
        namespaces: [],
      },
    };

    const expectedEnv = [
      { name: "PEPR_WATCH_MODE", value: "false" },
      { name: "PEPR_PRETTY_LOG", value: "false" },
      { name: "LOG_LEVEL", value: "error" },
    ];

    const result = genEnv(config);

    expect(result).toEqual(expectedEnv);
  });

  it("should not be able to override PEPR_WATCH_MODE in package.json pepr env", () => {
    const config: ModuleConfig = {
      uuid: "12345",
      logLevel: "error",
      env: {
        PEPR_WATCH_MODE: "false",
      },
      alwaysIgnore: {
        namespaces: [],
      },
    };

    const result = genEnv(config, true);
    const watchMode = result.filter(env => env.name === "PEPR_WATCH_MODE")[0];
    expect(watchMode.value).toEqual("true");
  });

  it("handles no config.env correctly", () => {
    const config: ModuleConfig = {
      uuid: "12345",
      logLevel: "error",
      alwaysIgnore: {
        namespaces: [],
      },
    };

    const expectedEnv = [
      { name: "PEPR_WATCH_MODE", value: "false" },
      { name: "PEPR_PRETTY_LOG", value: "false" },
      { name: "LOG_LEVEL", value: "error" },
    ];

    const result = genEnv(config);

    expect(result).toEqual(expectedEnv);
  });

  it("handles ignoreWatchMode for helm chart", () => {
    const config: ModuleConfig = {
      uuid: "12345",
      logLevel: "error",
      alwaysIgnore: {
        namespaces: [],
      },
    };

    const expectedEnv = [
      { name: "PEPR_PRETTY_LOG", value: "false" },
      { name: "LOG_LEVEL", value: "error" },
    ];

    const result = genEnv(config, false, true);

    expect(result).toEqual(expectedEnv);
  });
});
