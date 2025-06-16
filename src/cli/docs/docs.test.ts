import { describe, expect, it } from "@jest/globals";
import path from "path";
import * as childProcess from "child_process";
import { promisify } from "util";
import { getDocsForCommand } from "./markdown.helper";
import { parseCLIOutput } from "./cli.helper";

// Can probably simplify this. Tests take 30ish secs to run right now
const execFilePromise = promisify(childProcess.execFile);

describe("Pepr CLI Help Menu", () => {
  const cliPath = path.resolve(process.cwd(), "src/cli.ts");
  const command = async (
    subcommand: string = "",
  ): Promise<{
    stdout: string;
    stderr: string;
  }> => {
    const baseArgs = ["ts-node", cliPath];

    // If subcommand exists, split it by spaces and add each part as a separate argument
    const subcommandArgs = subcommand ? subcommand.split(/\s+/) : [];
    const args = [...baseArgs, ...subcommandArgs, "--help"];
    return await execFilePromise("npx", args);
  };

  describe("when 'npx pepr --help' executes", () => {
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
    }, 10000);

    it("should match documented CLI behavior", async () => {
      try {
        const { stdout, stderr } = await command();
        const docsContent = getDocsForCommand();
        const cliContent = parseCLIOutput(stdout);
        expect(docsContent).toStrictEqual(cliContent);
        expect(stderr).toBeFalsy();
      } catch (error) {
        console.error("Error executing CLI:", error);
        expect(error).toBeUndefined();
      }
    }, 10000);
  });

  describe.each([
    { commandName: "build" },
    { commandName: "crd create" },
    { commandName: "crd generate" },
    { commandName: "crd" },
    { commandName: "deploy" },
    { commandName: "dev" },
    { commandName: "format" },
    { commandName: "init" },
    { commandName: "kfc" },
    { commandName: "monitor" },
    { commandName: "update" },
    { commandName: "uuid" },
  ])("when 'npx pepr $commandName --help' executes", ({ commandName }) => {
    it("should match documented CLI behavior", async () => {
      try {
        const { stdout, stderr } = await command(commandName);
        const docsContent = getDocsForCommand(commandName);
        const cliContent = parseCLIOutput(stdout);
        expect(docsContent).toStrictEqual(cliContent);
        expect(stderr).toBeFalsy();
      } catch (error) {
        console.error("Error executing CLI:", error);
        expect(error).toBeUndefined();
      }
    }, 10000);
  });
});
