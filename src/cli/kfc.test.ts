// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import kfcCommand from "./kfc";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));
vi.mock("prompts", () => ({
  default: vi.fn(),
}));

import { execSync } from "child_process";
import prompts from "prompts";

const mockedExecSync = vi.mocked(execSync);
const mockedPrompts = vi.mocked(prompts);

describe("kfc CLI command", () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    kfcCommand(program);
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips prompt and executes with --yes", async () => {
    const command = program.commands.find(c => c.name() === "kfc");
    await command?.parseAsync(["--yes", "crd", "https://kubernetes.io/some-crd", "./generated"], {
      from: "user",
    });

    expect(mockedPrompts).not.toHaveBeenCalled();
    expect(mockedExecSync).toHaveBeenCalledWith(
      "kubernetes-fluent-client crd https://kubernetes.io/some-crd ./generated",
      {
        stdio: "inherit",
      },
    );
  });

  it("prompts and exits early if user declines", async () => {
    mockedPrompts.mockResolvedValueOnce({ confirm: false });

    const command = program.commands.find(c => c.name() === "kfc");
    await command?.parseAsync(["crd", "https://kubernetes.io/some-crd", "./generated"], {
      from: "user",
    });

    expect(mockedPrompts).toHaveBeenCalled();
    expect(mockedExecSync).not.toHaveBeenCalled();
  });

  it("prompts and executes if user confirms", async () => {
    mockedPrompts.mockResolvedValueOnce({ confirm: true });

    const command = program.commands.find(c => c.name() === "kfc");
    await command?.parseAsync(["crd", "https://kubernetes.io/some-crd", "./generated"], {
      from: "user",
    });

    expect(mockedPrompts).toHaveBeenCalled();
    expect(mockedExecSync).toHaveBeenCalledWith(
      "kubernetes-fluent-client crd https://kubernetes.io/some-crd ./generated",
      {
        stdio: "inherit",
      },
    );
  });

  it("injects --help when no args are given", async () => {
    const command = program.commands.find(c => c.name() === "kfc");
    await command?.parseAsync(["--yes"], { from: "user" });

    expect(mockedExecSync).toHaveBeenCalledWith("kubernetes-fluent-client --help", {
      stdio: "inherit",
    });
  });

  it("logs error and exits on execSync failure", async () => {
    mockedPrompts.mockResolvedValueOnce({ confirm: true });

    const error = new Error("test fail");
    mockedExecSync.mockImplementation(() => {
      throw error;
    });

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const command = program.commands.find(c => c.name() === "kfc");

    try {
      await command?.parseAsync(["fail"], { from: "user" });
    } catch {
      // going to fail because fail is not a KFC command
    }

    expect(errorSpy).toHaveBeenCalledWith("Error creating CRD generated class:", error);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
