import { Command } from "commander";
import generate from ".";
import { describe } from "node:test";
import { beforeEach, expect, it, vi } from "vitest";
import { generateCRDs } from "./generators";

vi.mock("./generators", () => ({
  generateCRDs: vi.fn().mockResolvedValue(undefined),
}));

describe("generate CLI command", () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    program.addCommand(generate());
  });

  it("should generate CRDs in the default directory", async () => {
    const args = ["generate"];
    await program.parseAsync(args, { from: "user" });
    expect(generateCRDs).toHaveBeenCalledWith({ output: "./crds" });
  });

  it("should generate CRDs in a user-specified directory", async () => {
    const args = ["generate", "--output", "./custom-path"];
    await program.parseAsync(args, { from: "user" });
    expect(generateCRDs).toHaveBeenCalledWith({ output: "./custom-path" });
  });
});
