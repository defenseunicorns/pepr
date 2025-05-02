import { describe, expect, it } from "@jest/globals";
import fs from "fs";

const cliDocsPath = "./docs/030_user-guide/010_pepr-cli.md";

const parseSection = (section: string): { options: string[]; commands: string[] } => {
  const hasOptions = section.includes("**Options:**");
  const hasCommands = section.includes("**Commands:**");

  // Parse options with CLI pattern matching
  const options = hasOptions
    ? section
        .split("**Options:**")[1]
        .split(/(?:\*\*Commands:\*\*|\n## )/)[0]
        .split("\n")
        .filter(line => line.trim().match(/^- `-[a-zA-Z]/))
    : [];

  // Parse commands
  const commands = hasCommands
    ? section
        .split("**Commands:**")[1]
        .split(/\n\s*\n\*\*|\n## /)[0]
        .split("\n")
        .filter(line => {
          const trimmed = line.trim();
          return trimmed && !trimmed.startsWith("-") && !trimmed.startsWith("*");
        })
    : [];

  return { options, commands };
};

const getDocsForCommand = (cmd: string = ""): { options: string[]; commands: string[] } => {
  const docsContent = fs.readFileSync(cliDocsPath, "utf-8");

  const commandToFind = cmd ? `npx pepr ${cmd}` : "npx pepr";

  // Split the doc by section headings (all lines starting with "## `npx pepr")
  const sections = docsContent.split(/\n## `npx pepr/);

  // Find the section that matches our command
  const targetSection = sections.find(section => {
    if (!cmd) return section.startsWith("`") || section.startsWith(" `");
    return section.startsWith(` ${cmd}\``) || section.startsWith(`${cmd}\``);
  });

  if (!targetSection) throw new Error(`Documentation for command '${commandToFind}' not found.`);

  return parseSection(`## \`npx pepr${targetSection}`);
};

describe("getDocsForCommand", () => {
  it.each([
    { command: "", optionsCount: 2, subcommands: 10 },
    { command: "build", optionsCount: 12, subcommands: 0 },
    { command: "crd", optionsCount: 1, subcommands: 3 },
    { command: "crd create", optionsCount: 8, subcommands: 0 },
    { command: "crd generate", optionsCount: 2, subcommands: 0 },
    { command: "deploy", optionsCount: 9, subcommands: 0 },
    { command: "dev", optionsCount: 3, subcommands: 0 },
    { command: "format", optionsCount: 2, subcommands: 0 },
    { command: "init", optionsCount: 7, subcommands: 0 },
    { command: "kfc", optionsCount: 1, subcommands: 0 },
    { command: "monitor", optionsCount: 1, subcommands: 0 },
    { command: "update", optionsCount: 2, subcommands: 0 },
    { command: "uuid", optionsCount: 1, subcommands: 0 },
  ])(
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
