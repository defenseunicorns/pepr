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

const isSectionSeparator = (line: string): boolean => {
  const trimmed = line.trim();
  return !trimmed || trimmed === "Options:" || trimmed === "Commands:" || trimmed === "";
};

const isCommandLine = (line: string): boolean => {
  return !line.startsWith("-") && Boolean(line.match(/^\S+(\s+\[.+?\])?\s{2,}/));
};

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
