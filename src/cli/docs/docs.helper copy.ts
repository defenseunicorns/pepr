import fs from "fs";

const cliDocsPath = "./docs/030_user-guide/010_pepr-cli.md";

/**
 * Parse CLI output into options and commands
 */
export const parseCLIOutput = (cliOutput: string): { options: string[]; commands: string[] } => {
  const lines = cliOutput.split("\n");
  const optionsIndex = lines.findIndex(line => line.trim().startsWith("Options:"));
  const commandsIndex = lines.findIndex(line => line.trim().startsWith("Commands:"));

  return {
    options: extractOptionsFromLines(lines, optionsIndex, commandsIndex),
    commands: extractCommandsFromLines(lines, commandsIndex),
  };
};

/**
 * Extract options from an array of lines
 */
const extractOptionsFromLines = (
  lines: string[],
  optionsIndex: number,
  commandsIndex: number,
): string[] => {
  if (optionsIndex === -1) return [];

  const endIndex = commandsIndex === -1 ? lines.length : commandsIndex;
  return lines
    .slice(optionsIndex + 1, endIndex)
    .map(line => line.trim())
    .filter(line => line && line.startsWith("-"));
};

/**
 * Check if a line should be treated as a section separator
 */
const isSectionSeparator = (line: string): boolean => {
  const trimmed = line.trim();
  return !trimmed || trimmed === "Options:" || trimmed === "Commands:" || trimmed === "";
};

/**
 * Check if a line represents a new command
 */
const isCommandLine = (line: string): boolean => {
  return !line.startsWith("-") && Boolean(line.match(/^\S+(\s+\[.+?\])?\s{2,}/));
};

/**
 * Check if a line is a continuation of a previous command (has significant indentation)
 */
const isContinuationLine = (line: string): boolean => {
  return Boolean(line.match(/^\s{20,}/));
};

/**
 * Join a continuation line to its parent command
 */
const joinContinuationLine = (command: string, continuation: string): string => {
  const baseCommand = command.replace(/\s+$/, "");
  return `${baseCommand} ${continuation}`;
};

/**
 * Process a single command line in the context of already processed commands
 */
const processCommandLine = (
  result: { commands: string[]; currentCommand: string | null },
  line: string,
  originalLine: string,
): { commands: string[]; currentCommand: string | null } => {
  const trimmedLine = line.trim();

  // Skip section separators
  if (isSectionSeparator(trimmedLine)) {
    return result;
  }

  // Handle new command
  if (isCommandLine(trimmedLine)) {
    return {
      commands: [...result.commands, trimmedLine],
      currentCommand: trimmedLine,
    };
  }

  // Handle continuation of current command
  if (result.currentCommand && isContinuationLine(originalLine)) {
    const updatedCommands = [...result.commands];
    const lastIndex = updatedCommands.length - 1;

    if (lastIndex >= 0) {
      updatedCommands[lastIndex] = joinContinuationLine(updatedCommands[lastIndex], trimmedLine);
    }

    return {
      commands: updatedCommands,
      currentCommand: result.currentCommand,
    };
  }

  return result;
};

/**
 * Extract commands from an array of lines using a functional approach
 */
const extractCommandsFromLines = (lines: string[], commandsIndex: number): string[] => {
  if (commandsIndex === -1) return [];

  // Get command section lines
  const commandLines = lines.slice(commandsIndex + 1);

  // Find the first empty line index (if any)
  const emptyLineIndex = commandLines.findIndex(line => line.trim() === "");

  // Slice up to empty line or use all lines if no empty line found
  const relevantLines =
    emptyLineIndex !== -1 ? commandLines.slice(0, emptyLineIndex) : commandLines;

  // Process the lines in sequence, tracking state
  const result = relevantLines.reduce<{ commands: string[]; currentCommand: string | null }>(
    (acc, line) => processCommandLine(acc, line, line),
    { commands: [], currentCommand: null },
  );

  return result.commands;
};

/**
 * Get documentation for a Pepr command from the markdown docs
 */
export const getDocsForCommand = (cmd: string = ""): { options: string[]; commands: string[] } => {
  const docsContent = fs.readFileSync(cliDocsPath, "utf-8");
  const commandToFind = cmd ? `npx pepr ${cmd}` : "npx pepr";

  // Find section matching the command
  const sections = docsContent.split(/\n## `npx pepr/);
  const targetSection = sections.find(section =>
    !cmd
      ? section.startsWith("`") || section.startsWith(" `")
      : section.startsWith(` ${cmd}\``) || section.startsWith(`${cmd}\``),
  );

  if (!targetSection) throw new Error(`Documentation for command '${commandToFind}' not found.`);

  // Extract and normalize options and commands
  const { options, commands } = parseMarkdownSection(`## \`npx pepr${targetSection}`);
  return {
    options: options.map(normalizeOption),
    commands,
  };
};

/**
 * Parse a markdown section for options and commands
 */
const parseMarkdownSection = (section: string): { options: string[]; commands: string[] } => {
  const hasOptions = section.includes("**Options:**");
  const hasCommands = section.includes("**Commands:**");

  return {
    options: hasOptions
      ? section
          .split("**Options:**")[1]
          .split(/(?:\*\*Commands:\*\*|\n## )/)[0]
          .split("\n")
          .filter(line => line.trim().match(/^- `-[a-zA-Z]/))
      : [],

    commands: hasCommands
      ? section
          .split("**Commands:**")[1]
          .split(/\n\s*\n\*\*|\n## /)[0]
          .split("\n")
          .map(line => line.trim())
          .filter(line => line && !line.startsWith("-") && !line.startsWith("*"))
      : [],
  };
};

/**
 * Normalize option text from markdown to CLI format
 */
const normalizeOption = (option: string): string => {
  if (!option.startsWith("- `-")) return option;

  const match = option.match(/^- `-([^`]+)`(\s+)(.*)$/);
  return match ? `-${match[1]}${match[2]}${match[3]}` : option.replace(/^- `-([^`]+)`\s+/, "-$1 ");
};
