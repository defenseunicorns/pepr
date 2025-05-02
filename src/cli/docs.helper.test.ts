import { describe, expect, it } from "@jest/globals";
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

describe("parseCLIOutput", () => {
  describe("when parsing CLI output with both options and commands", () => {
    const sampleOutput = `
    Usage: pepr [options] [command]

    Type safe K8s middleware for humans

    Options:
      -V, --version          output the version number
      -h, --help             display help for command

    Commands:
      init [options]         Initialize a new Pepr Module
      build [options]        Build a Pepr Module for deployment
      deploy [options]       Deploy a Pepr Module
    `;

    it("should extract all options", () => {
      const result = parseCLIOutput(sampleOutput);

      expect(result.options).toHaveLength(2);
      expect(result.options).toContain("-V, --version          output the version number");
      expect(result.options).toContain("-h, --help             display help for command");
    });

    it("should extract all commands", () => {
      const result = parseCLIOutput(sampleOutput);

      expect(result.commands).toHaveLength(3);
      expect(result.commands).toContain("init [options]         Initialize a new Pepr Module");
      expect(result.commands).toContain(
        "build [options]        Build a Pepr Module for deployment",
      );
      expect(result.commands).toContain("deploy [options]       Deploy a Pepr Module");
    });
  });

  describe("when parsing CLI output with only options", () => {
    const optionsOnlyOutput = `
    Usage: pepr uuid [options]

    Module UUID(s) currently deployed in the cluster

    Options:
      -h, --help             display help for command
    `;

    it("should extract options but no commands", () => {
      const result = parseCLIOutput(optionsOnlyOutput);

      expect(result.options).toHaveLength(1);
      expect(result.options).toContain("-h, --help             display help for command");
      expect(result.commands).toHaveLength(0);
    });
  });

  describe("when parsing CLI output with only commands", () => {
    const commandsOnlyOutput = `
    Usage: pepr crd [options] [command]

    Scaffold and generate Kubernetes CRDs

    Commands:
      create [options]       Create a new CRD TypeScript definition
      generate [options]     Generate CRD manifests from TypeScript definitions
      help [command]         display help for command
    `;

    it("should extract commands but no options", () => {
      const result = parseCLIOutput(commandsOnlyOutput);

      expect(result.commands).toHaveLength(3);
      expect(result.options).toHaveLength(0);
    });
  });

  describe("when parsing CLI output with multiline command descriptions", () => {
    const multilineOutput = `
    Usage: pepr [options] [command]

    Type safe K8s middleware for humans

    Options:
      -V, --version          output the version number
      -h, --help             display help for command

    Commands:
      init [options]         Initialize a new Pepr Module
      update [options]       Update this Pepr module. Not recommended for prod as it
                             may change files.
      format [options]       Lint and format this Pepr module
    `;

    it("should properly handle multiline command descriptions", () => {
      const result = parseCLIOutput(multilineOutput);

      expect(result.commands).toHaveLength(3);
      expect(result.commands).toContain("init [options]         Initialize a new Pepr Module");
      expect(result.commands).toContain(
        "update [options]       Update this Pepr module. Not recommended for prod as it may change files.",
      );
      expect(result.commands).toContain("format [options]       Lint and format this Pepr module");
    });
  });

  describe("when parsing empty CLI output", () => {
    it("should return empty arrays", () => {
      const result = parseCLIOutput("");

      expect(result.options).toHaveLength(0);
      expect(result.commands).toHaveLength(0);
    });
  });
});
