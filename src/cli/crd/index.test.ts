import { Command } from "commander";
import create from "./create";
import generate from "./generate";
import { beforeEach, describe, expect, it, vi } from "vitest";
import crd from ".";

vi.mock(import("./create"), async () => {
  return {
    default: vi.fn().mockReturnValue(new Command().name("create")),
  };
});
vi.mock(import("./generate"), async () => {
  return {
    default: vi.fn().mockReturnValue(new Command().name("generate")),
  };
});

describe("crd CLI command", () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    program.addCommand(crd());
  });

  describe("when 'pepr crd create' runs", () => {
    it("should call the Create command", async () => {
      program.parseAsync(["crd", "create"], { from: "user" });
      expect(create).toBeCalled();
    });
  });
  describe("when 'pepr crd generate' runs", () => {
    it("should call the Generate command", async () => {
      program.parseAsync(["crd", "generate"], { from: "user" });
      expect(generate).toBeCalled();
    });
  });
});
