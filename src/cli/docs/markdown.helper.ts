import fs from "fs";

const cliDocsPath = "./docs/030_user-guide/010_pepr-cli.md";

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
    options: options.map(normalizeOption).map(option => option.replace(" - ", "  ")),
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
