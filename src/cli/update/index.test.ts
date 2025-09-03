import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { Command } from "commander";
import updateCommand from "./index";
import * as child_process from "child_process";
import * as fs from "fs";
import * as utils from "../init/utils";
import prompt from "prompts";
import Log from "../../lib/telemetry/logger";

vi.mock("prompts");
vi.mock("child_process");
vi.mock("fs");
vi.mock("../init/utils");
vi.mock("../../lib/telemetry/logger", () => ({
  __esModule: true,
  default: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

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
    expect(Log.info).toHaveBeenCalledWith("Updating the Pepr module...");
    expect(Log.info).toHaveBeenCalledWith("✅ Module updated successfully");
  });

  it("doesn't prompt the user if --yes is passed", async () => {
    vi.mocked(child_process.execSync).mockImplementation(() => Buffer.from(""));

    await program.parseAsync(["update", "--yes"], { from: "user" });

    expect(prompt).not.toHaveBeenCalled();
    expect(child_process.execSync).toHaveBeenCalledWith("npm install pepr@latest", {
      stdio: "inherit",
    });
    expect(Log.info).toHaveBeenCalledWith("Updating the Pepr module...");
    expect(Log.info).toHaveBeenCalledWith("✅ Module updated successfully");
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
    expect(Log.info).toHaveBeenCalledWith("Updating the Pepr module...");
    expect(Log.info).toHaveBeenCalledWith("✅ Module updated successfully");
  });

  it("aborts update if user declines prompt", async () => {
    vi.mocked(prompt).mockResolvedValue({ confirm: false });

    await program.parseAsync(["update"], { from: "user" });

    expect(child_process.execSync).not.toHaveBeenCalled();
    expect(Log.info).not.toHaveBeenCalled();
    expect(Log.error).not.toHaveBeenCalled();
  });

  it("handles update error", async () => {
    vi.mocked(prompt).mockResolvedValue({ confirm: true });
    vi.mocked(child_process.execSync).mockImplementation(() => {
      throw new Error("some error");
    });

    await program.parseAsync(["update"], { from: "user" });
    expect(Log.info).toHaveBeenCalledWith("Updating the Pepr module...");
    expect(Log.error).toHaveBeenCalledWith(expect.anything(), "Error updating Pepr module:");
  });

  it("updates templates fully", async () => {
    (fs.existsSync as Mock).mockImplementation(() => true);
    const writeMock = vi.fn();
    vi.mocked(utils.write).mockImplementation(writeMock);

    await program.parseAsync(["update-templates"], { from: "user" });

    expect(writeMock).toHaveBeenCalled();
    expect(fs.unlinkSync).toHaveBeenCalled();

    expect(Log.info).toHaveBeenCalledWith("Updating Pepr config and template files...");
    expect(Log.error).not.toHaveBeenCalled();
  });
});
