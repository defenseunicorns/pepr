import { describe, expect, it } from "@jest/globals";
import path from "path";
import * as childProcess from "child_process";
import { promisify } from "util";

// Can probably simplify this. Tests take 30ish secs to run right now
const execPromise = promisify(childProcess.exec);

describe("Pepr CLI Help Menu", () => {
  const cliPath = path.resolve(process.cwd(), "src/cli.ts");
  const command = async (subcommand: string = "") =>
    await execPromise(`npx ts-node ${cliPath} ${subcommand} --help`);

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
