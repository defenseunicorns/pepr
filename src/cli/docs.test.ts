import { describe, expect, it } from "@jest/globals";
import path from "path";
import * as childProcess from "child_process";
import { promisify } from "util";
import fs from "fs";

// Can probably simplify this. Tests take 30ish secs to run right now
const execPromise = promisify(childProcess.exec);

describe("Pepr CLI Help Menu", () => {
  const cliDocsPath = "./docs/030_user-guide/010_pepr-cli.md";
  const cliPath = path.resolve(process.cwd(), "src/cli.ts");
  const command = async (subcommand: string = "") =>
    await execPromise(`npx ts-node ${cliPath} ${subcommand} --help`);

  const getDocsForCommand = (cmd: string = "") => {
    // Read the docs file
    const docsContent = fs.readFileSync(cliDocsPath, "utf-8");

    // Format the section heading pattern - for either main command or subcommand
    const peprCommand = cmd ? `npx pepr ${cmd}` : `npx pepr`;
    // Regexr against .md
    // (?<=## `npx pepr`\s\s)(?'menuItem'Type safe.*\s\s\*\*Options\:\*\*\s\s(?'options'(?'option'- `-., --.*\s)+)\s\*\*Commands:\*\*\s\s(?'commands'(?'command'  .*\s)+))(?=\s## `npx pepr.*`)
    const headingPattern = new RegExp(
      `## \`${peprCommand}\`[\\s\\S]*?(?<menuItem>[A-Z].*\\s\\s\\*\\*Options:\\*\\*\\s\\s(?<options>(?<option>- \`-., --.*\\s)+)\\s\\*\\*Commands:\\*\\*\\s\\s(?<commands>(?<command>  .*\\s)+))(?=\\s## \`npx pepr.*\`|$)`,
      "m",
    );

    //Hardcoded to regex results, refactor later
    const optsIndex = 2;
    const cmdsIndex = 4;

    // Find the matching section
    let match = docsContent.match(headingPattern);

    if (!match) {
      //Command may not have subcommands
      // (?<=## `npx pepr build`\s\s)(?'menuItem'[A-Z].*\s\s\*\*Options:\*\*)\s\s(?'options'(?'option'- \`-., --.*\s)+)
      // (?<=## `npx pepr crd create`\s\s)(?'menuItem'[A-Z].*\s\s\*\*Options:\*\*)\s\s(?'options'(?'option'- \`-., --.*\s)+)

      const optsOnlyPattern = new RegExp(
        `## \`${peprCommand}\`[\\s\\S]*?(?<menuItem>[A-Z].*\\s\\s\\*\\*Options:\\*\\*\\s\\s(?<options>(?<option>- \`-., --.*\\s)+))(?=\\s## \`npx pepr.*\`|$)`,
        "m",
      );
      match = docsContent.match(optsOnlyPattern);

      if (!match) {
        throw new Error(
          `Documentation for command 'npx pepr ${cmd}' not found. Command does not match regexes.`,
        );
      }
      return {
        options: match[optsIndex]
          .split("\n")
          .map(item => item.trim())
          .filter(item => item.startsWith("-")),
        commands: [],
      };
    }

    // Return the matched section (trimmig any trailing whitespace)
    return {
      options: match[optsIndex]
        .split("\n")
        .map(item => item.trim())
        .filter(item => item.startsWith("-")),
      commands: match[cmdsIndex]
        .split("\n")
        .map(item => item.trim())
        .filter(item => item !== ""),
    };
  };

  describe.only("getDocsForCommand", () => {
    it("should extract the main pepr command section correctly", () => {
      const { options, commands } = getDocsForCommand();
      expect(options).toHaveLength(2);
      expect(commands).toHaveLength(10);
    });

    it("should extract the pepr build command section correctly", () => {
      const { options, commands } = getDocsForCommand("build");
      expect(options).toHaveLength(12);
      expect(commands).toHaveLength(0);
    });

    it("should extract nested commands like crd create correctly", () => {
      const { options, commands } = getDocsForCommand("crd create");
      expect(options).toHaveLength(8);
      expect(commands).toHaveLength(0);
    });

    it("should throw an error for non-existent commands", () => {
      expect(() => getDocsForCommand("nonexistent")).toThrow(
        "Documentation for command 'npx pepr nonexistent' not found.",
      );
    });
  });

  describe("when `pepr --help` executes", () => {
    it("should display the help menu with correct information", async () => {
      try {
        const { stdout, stderr } = await command();

        expect(stdout).toBeTruthy();
        expect(stdout).toContain("-V, --version          output the version number");
        expect(stdout).toContain("-h, --help             display help for command");
        expect(stderr).toBeFalsy();
        expect(stdout).toContain("Type safe K8s middleware for humans");
      } catch (error) {
        console.error("Error executing CLI:", error);
        expect(error).toBeUndefined();
      }
    });

    // it("should match documented CLI behavior", async () => {
    //   try {
    //     const { stdout, stderr } = await command();
    //     const docsContent = getDocsForCommand();

    //   } catch (error) {
    //     console.error("Error executing CLI:", error);
    //     expect(error).toBeUndefined(); }
    // });
  });

  describe("when `pepr build --help` executes", () => {
    it("does something", async () => {
      const { stdout, stderr } = await command("build");
      expect(stdout).toBeTruthy();
      expect(stderr).toBeFalsy();
    });
  });

  describe("when `pepr crd --help` executes", () => {
    it("does something", async () => {
      const { stdout, stderr } = await command("crd");
      expect(stdout).toBeTruthy();
      expect(stderr).toBeFalsy();
    });
  });

  describe("when `pepr crd create --help` executes", () => {
    it("does something", async () => {
      const { stdout, stderr } = await command("crd create");
      expect(stdout).toBeTruthy();
      expect(stderr).toBeFalsy();
    });
  });

  describe("when `pepr crd generate --help` executes", () => {
    it("does something", async () => {
      const { stdout, stderr } = await command("crd generate");
      expect(stdout).toBeTruthy();
      expect(stderr).toBeFalsy();
    });
  });

  describe("when `pepr deploy --help` executes", () => {
    it("does something", async () => {
      const { stdout, stderr } = await command("deploy");
      expect(stdout).toBeTruthy();
      expect(stderr).toBeFalsy();
    });
  });

  describe("when `pepr dev --help` executes", () => {
    it("does something", async () => {
      const { stdout, stderr } = await command("dev");
      expect(stdout).toBeTruthy();
      expect(stderr).toBeFalsy();
    });
  });
  describe("when `pepr format --help` executes", () => {
    it("does something", async () => {
      const { stdout, stderr } = await command("format");
      expect(stdout).toBeTruthy();
      expect(stderr).toBeFalsy();
    });
  });
  describe("when `pepr init --help` executes", () => {
    it("does something", async () => {
      const { stdout, stderr } = await command("init");
      expect(stdout).toBeTruthy();
      expect(stderr).toBeFalsy();
    });
  });
  describe("when `pepr kfc --help` executes", () => {
    it("does something", async () => {
      const { stdout, stderr } = await command("kfc");
      expect(stdout).toBeTruthy();
      expect(stderr).toBeFalsy();
    });
  });
  describe("when `pepr monitor --help` executes", () => {
    it("does something", async () => {
      const { stdout, stderr } = await command("monitor");
      expect(stdout).toBeTruthy();
      expect(stderr).toBeFalsy();
    });
  });
  describe("when `pepr update --help` executes", () => {
    it("does something", async () => {
      const { stdout, stderr } = await command("update");
      expect(stdout).toBeTruthy();
      expect(stderr).toBeFalsy();
    });
  });
  describe("when `pepr uuid --help` executes", () => {
    it("does something", async () => {
      const { stdout, stderr } = await command("uuid");
      expect(stdout).toBeTruthy();
      expect(stderr).toBeFalsy();
    });
  });
});
