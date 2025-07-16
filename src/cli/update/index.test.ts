import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { Command } from "commander";
import updateCommand from "./index";
import * as child_process from "child_process";
import * as fs from "fs";
import * as utils from "../init/utils";
import prompt from "prompts";

vi.mock("prompts");
vi.mock("child_process");
vi.mock("fs");
vi.mock("../init/utils");

describe("Pepr CLI Update Command", () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    updateCommand(program);
  });

  it("runs update with confirmation", async () => {
    vi.mocked(prompt).mockResolvedValue({ confirm: true });
    vi.mocked(child_process.execSync).mockImplementation(() => Buffer.from(""));

    await program.parseAsync(["update"], { from: "user" });

    expect(prompt).toHaveBeenCalled();
    expect(child_process.execSync).toHaveBeenCalledWith("npm install pepr@latest", {
      stdio: "inherit",
    });
    expect(child_process.execSync).toHaveBeenCalledWith("npx pepr update-templates", {
      stdio: "inherit",
    });
  });

  it("skips template update", async () => {
    vi.mocked(child_process.execSync).mockImplementation(() => Buffer.from(""));

    await program.parseAsync(["update", "--skip-template-update"], { from: "user" });

    expect(prompt).not.toHaveBeenCalled();
    expect(child_process.execSync).toHaveBeenCalledWith("npm install pepr@latest", {
      stdio: "inherit",
    });
    expect(child_process.execSync).not.toHaveBeenCalledWith(
      "npx pepr update-templates",
      expect.anything(),
    );
  });

  it("aborts update if user declines prompt", async () => {
    vi.mocked(prompt).mockResolvedValue({ confirm: false });

    await program.parseAsync(["update"], { from: "user" });

    expect(child_process.execSync).not.toHaveBeenCalled();
  });

  it("handles update error", async () => {
    vi.mocked(prompt).mockResolvedValue({ confirm: true });
    vi.mocked(child_process.execSync).mockImplementation(() => {
      throw new Error("fail");
    });

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await program.parseAsync(["update"], { from: "user" });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("Error updating Pepr module:"),
      expect.anything(),
    );
    spy.mockRestore();
  });

  it("updates templates fully", async () => {
    (fs.existsSync as Mock).mockImplementation(() => true);
    const writeMock = vi.fn();
    vi.mocked(utils.write).mockImplementation(writeMock);

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const spyErr = vi.spyOn(console, "error").mockImplementation(() => {});

    await program.parseAsync(["update-templates"], { from: "user" });

    expect(writeMock).toHaveBeenCalled();
    expect(fs.unlinkSync).toHaveBeenCalled();
    expect(spyErr).not.toHaveBeenCalled();

    spy.mockRestore();
    spyErr.mockRestore();
  });
});
