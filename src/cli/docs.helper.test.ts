import { describe, expect, it } from "@jest/globals";
import fs from "fs";

const cliDocsPath = "./docs/030_user-guide/010_pepr-cli.md";

/**
 * Parse CLI options from markdown text, filtering for actual CLI options
 */
const parseOptions = (optionsText: string): string[] => {
  return optionsText
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.startsWith("- ") && line.match(/- `-[a-zA-Z]/) !== null);
};

/**
 * Parse commands from markdown text
 */
const parseCommands = (commandsText: string): string[] => {
  return commandsText
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith("- ") && !line.startsWith("*"));
};

/**
 * Extract the main 'npx pepr' command from the docs
 */
const getMainCommand = (docsContent: string): { options: string[]; commands: string[] } => {
  const mainPattern = new RegExp("## `npx pepr`[\\s\\S]*?(?=## `npx pepr )", "m");
  const match = docsContent.match(mainPattern);

  if (!match) {
    throw new Error("Documentation for main 'npx pepr' command not found.");
  }

  const section = match[0];
  const hasOptions = section.includes("**Options:**");
  const hasCommands = section.includes("**Commands:**");

  let options: string[] = [];
  if (hasOptions) {
    const optionsPart = section.split("**Options:**")[1].split("**Commands:**")[0];
    options = parseOptions(optionsPart);
  }

  let commands: string[] = [];
  if (hasCommands) {
    const commandsPart = section.split("**Commands:**")[1];
    commands = parseCommands(commandsPart);
  }

  return { options, commands };
};

/**
 * Extract a specific command from the docs
 */
const getSpecificCommand = (
  docsContent: string,
  cmd: string,
): { options: string[]; commands: string[] } => {
  // Split the doc by section headings (all lines starting with "## `npx pepr")
  const sections: string[] = docsContent.split(/\n## `npx pepr/);

  // Find the section that starts with our command
  const targetSection: string | undefined = sections.find(
    section => section.startsWith(` ${cmd}\``) || section.startsWith(`${cmd}\``),
  );

  if (!targetSection) {
    throw new Error(`Documentation for command 'npx pepr ${cmd}' not found.`);
  }

  // Add back the section heading for consistent processing
  const fullSection: string = `## \`npx pepr${targetSection}`;

  return extractCommandInfo(fullSection);
};

/**
 * Extract options and commands from a command section
 */
const extractCommandInfo = (section: string): { options: string[]; commands: string[] } => {
  const hasOptions = section.includes("**Options:**");
  const hasCommands = section.includes("**Commands:**");

  let options: string[] = [];
  if (hasOptions) {
    const optionsPart = section.split("**Options:**")[1];
    // Split at the next section or command header
    const optionsText = optionsPart.split(/\n\s*\n\*\*|\n## /)[0];
    options = parseOptions(optionsText);
  }

  let commands: string[] = [];
  if (hasCommands) {
    const commandsPart = section.split("**Commands:**")[1];
    const commandsText = commandsPart.split(/\n\s*\n\*\*|\n## /)[0];
    commands = parseCommands(commandsText);
  }

  return { options, commands };
};

/**
 * Get documentation for a Pepr command
 */
const getDocsForCommand = (cmd: string = ""): { options: string[]; commands: string[] } => {
  // Read the docs file
  const docsContent: string = fs.readFileSync(cliDocsPath, "utf-8");

  // Handle main command separately
  if (!cmd) {
    return getMainCommand(docsContent);
  }

  // Handle specific commands
  return getSpecificCommand(docsContent, cmd);
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
