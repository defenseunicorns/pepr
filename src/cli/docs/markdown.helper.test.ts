import { describe, it, expect } from "@jest/globals";
import { getDocsForCommand } from "./markdown.helper";

describe("getDocsForCommand", () => {
  it.each([{ command: "", optionsCount: 2, subcommands: 10 }])(
    "should extract the npx pepr $command command ($optionsCount options, $subcommands subcommands)",
    ({ command, optionsCount, subcommands }) => {
      const { options, commands } = getDocsForCommand(command);
      expect(options).toHaveLength(optionsCount);
      expect(commands).toHaveLength(subcommands);
    },
  );

  it("should throw an error for non-existent commands", () => {
    expect(() => getDocsForCommand("nonexistent")).toThrow(
      "Documentation for command 'npx pepr nonexistent' not found.",
    );
  });
});
