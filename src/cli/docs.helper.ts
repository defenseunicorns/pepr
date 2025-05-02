import fs from "fs";

const cliDocsPath = "./docs/030_user-guide/010_pepr-cli.md";

/**
 * Extract CLI options from a section of text
 */
const extractOptions = (lines: string[], optionsIndex: number, commandsIndex: number): string[] => {
  const options: string[] = [];
  if (optionsIndex === -1) return options;

  let i = optionsIndex + 1;
  const endIndex = commandsIndex === -1 ? lines.length : commandsIndex;

  while (i < endIndex) {
    const line = lines[i].trim();
    if (line && line.startsWith("-")) {
      options.push(line);
    }
    i++;
  }

  return options;
};

/**
 * Check if a line represents a new command
 */
const isCommandLine = (line: string): boolean => {
  return !line.startsWith("-") && line.match(/^\S+(\s+\[.+?\])?\s{2,}/) !== null;
};

/**
 * Check if a line is a continuation of a previous command
 */
const isContinuationLine = (line: string): boolean => {
  return line.match(/^\s{20,}/) !== null;
};

/**
 * Extract CLI commands from a section of text
 */
const extractCommands = (lines: string[], commandsIndex: number): string[] => {
  const commands: string[] = [];
  if (commandsIndex === -1) return commands;

  let i = commandsIndex + 1;
  let currentCommandIndex = -1;

  while (i < lines.length) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Skip empty lines or section headers
    if (!trimmedLine || trimmedLine.startsWith("Options:") || trimmedLine === "Commands:") {
      if (trimmedLine === "") break; // Stop at blank line
      i++;
      continue;
    }

    if (isCommandLine(trimmedLine)) {
      // New command found
      commands.push(trimmedLine);
      currentCommandIndex = commands.length - 1;
    } else if (currentCommandIndex !== -1 && isContinuationLine(line)) {
      // Join continuation line to current command
      const continuation = trimmedLine;
      const currentCommand = commands[currentCommandIndex];

      // Replace trailing spaces with a single space before joining
      const baseCommand = currentCommand.replace(/\s+$/, "");
      commands[currentCommandIndex] = `${baseCommand} ${continuation}`;
    }

    i++;
  }

  return commands;
};

/**
 * Parse CLI output into options and commands
 */
export const parseCLIOutput = (cliOutput: string): { options: string[]; commands: string[] } => {
  const lines = cliOutput.split("\n");

  // Find section boundaries
  const optionsIndex = lines.findIndex(line => line.trim().startsWith("Options:"));
  const commandsIndex = lines.findIndex(line => line.trim().startsWith("Commands:"));

  // Extract options and commands
  const options = extractOptions(lines, optionsIndex, commandsIndex);
  const commands = extractCommands(lines, commandsIndex);

  return { options, commands };
};

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
        .map(line => line.trim())
        .filter(line => {
          const trimmed = line.trim();
          return trimmed && !trimmed.startsWith("-") && !trimmed.startsWith("*");
        })
    : [];

  return { options, commands };
};

export const getDocsForCommand = (cmd: string = ""): { options: string[]; commands: string[] } => {
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
