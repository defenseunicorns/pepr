import { describe, expect, it } from "@jest/globals";
import path from "path";
import * as childProcess from "child_process";
import { promisify } from "util";

const execPromise = promisify(childProcess.exec);

describe("Pepr CLI Help Menu", () => {
  const cliPath = path.resolve(process.cwd(), "src/cli.ts");
  describe("when `pepr --help` executes", () => {
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

  describe("when `pepr build --help` executes", () => {
    it("does something", () => {
      expect(true).toBeTruthy();
    });
  });

  describe("when `pepr crd --help` executes", () => {
    it("does something", () => {
      expect(true).toBeTruthy();
    });
  });

  describe("when `pepr crd create --help` executes", () => {
    it("does something", () => {
      expect(true).toBeTruthy();
    });
  });

  describe("when `pepr crd generate --help` executes", () => {
    it("does something", () => {
      expect(true).toBeTruthy();
    });
  });

  describe("when `pepr deploy --help` executes", () => {
    it("does something", () => {
      expect(true).toBeTruthy();
    });
  });

  describe("when `pepr dev --help` executes", () => {
    it("does something", () => {
      expect(true).toBeTruthy();
    });
  });
  describe("when `pepr format --help` executes", () => {
    it("does something", () => {
      expect(true).toBeTruthy();
    });
  });
  describe("when `pepr init --help` executes", () => {
    it("does something", () => {
      expect(true).toBeTruthy();
    });
  });
  describe("when `pepr kfc --help` executes", () => {
    it("does something", () => {
      expect(true).toBeTruthy();
    });
  });
  describe("when `pepr monitor --help` executes", () => {
    it("does something", () => {
      expect(true).toBeTruthy();
    });
  });
  describe("when `pepr update --help` executes", () => {
    it("does something", () => {
      expect(true).toBeTruthy();
    });
  });
  describe("when `pepr uuid --help` executes", () => {
    it("does something", () => {
      expect(true).toBeTruthy();
    });
  });
});
