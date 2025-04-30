import { describe, expect, it } from "@jest/globals";
import path from "path";
import * as childProcess from "child_process";
import { promisify } from "util";

const execPromise = promisify(childProcess.exec);

describe("Pepr CLI Help Menu", () => {
  const cliPath = path.resolve(process.cwd(), "src/cli.ts");
  describe("when executing `pepr --help`", () => {
    it("should display the help menu with correct information", async () => {
      const command = `npx ts-node ${cliPath} --help`;

      try {
        const { stdout, stderr } = await execPromise(command);

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
  });
});
