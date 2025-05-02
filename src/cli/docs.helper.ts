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
 * Extract commands from an array of lines
 */
const extractCommandsFromLines = (lines: string[], commandsIndex: number): string[] => {
  if (commandsIndex === -1) return [];

  const commands: string[] = [];
  let currentCommandIndex = -1;
  let i = commandsIndex + 1;

  while (i < lines.length) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Stop processing if we hit a section separator
    if (isSectionSeparator(trimmedLine)) {
      if (trimmedLine === "") break;
      i++;
      continue;
    }

    // Process the line based on its type
    if (isCommandLine(trimmedLine)) {
      commands.push(trimmedLine);
      currentCommandIndex = commands.length - 1;
    } else if (currentCommandIndex !== -1 && isContinuationLine(line)) {
      commands[currentCommandIndex] = joinContinuationLine(
        commands[currentCommandIndex],
        trimmedLine,
      );
    }

    i++;
  }

  return commands;
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
