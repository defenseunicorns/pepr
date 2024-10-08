import { execFile } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { describe, beforeEach, test, expect, afterEach } from "@jest/globals";

// Utility function to execute the CLI command
const runCliCommand = (
  args: string[],
  callback: (error: Error | null, stdout: string, stderr: string) => void,
) => {
  execFile("node", ["./dist/cli.js", ...args], callback); // Path to built CLI JS file
};

// Utility function to compare generated files to expected files
const compareGeneratedToExpected = (generatedFile: string, expectedFile: string) => {
  // Check if the expected file exists
  expect(fs.existsSync(expectedFile)).toBe(true);

  // Read and compare the content of the generated file to the expected file
  const generatedContent = fs.readFileSync(generatedFile, "utf8").trim();
  const expectedContent = fs.readFileSync(expectedFile, "utf8").trim();

  expect(generatedContent).toBe(expectedContent);
};

describe("End-to-End CLI tests with multiple test files", () => {
  const testFolder = path.join(__dirname, "crds/test.yaml"); // Directory containing .test.yaml files

  // Get all .test.yaml files in the test folder
  const testFiles = fs.readdirSync(testFolder).filter(file => file.endsWith(".test.yaml"));

  testFiles.forEach(testFile => {
    const name = path.basename(testFile, ".test.yaml"); // Extract name from the filename
    const mockYamlPath = path.join(testFolder, testFile); // Full path to the test YAML file
    const mockDir = path.join(__dirname, "crds/", name); // Output directory based on name
    const expectedDir = path.join(__dirname, `crds/${name}.default.expected`); // Expected default directory
    const expectedPostDir = path.join(__dirname, `crds/${name}.no.post.expected`); // Expected post-processing directory

    const testInfoMessage = `
      Running tests for ${name}
                               Test file: ${mockYamlPath}
                        Output directory: ${mockDir}
                      Expected directory: ${expectedDir}
      Expected post-processing directory: ${expectedPostDir}
    `;

    console.log(testInfoMessage);

    beforeEach(() => {
      // Ensure the output directory is clean
      if (fs.existsSync(mockDir)) {
        fs.rmSync(mockDir, { recursive: true });
      }

      // Recreate the output directory
      fs.mkdirSync(mockDir);
    });

    afterEach(() => {
      // Cleanup the output directory after each test
      if (fs.existsSync(mockDir)) {
        fs.rmSync(mockDir, { recursive: true });
      }
    });

    test(`should generate TypeScript types and run post-processing for ${name}`, done => {
      // Run the CLI command with the appropriate arguments
      runCliCommand(["crd", mockYamlPath, mockDir], (error, stdout) => {
        expect(error).toBeNull(); // Ensure no errors occurred

        // Get the list of generated files
        const generatedFiles = fs.readdirSync(mockDir);

        // Compare each generated file to the corresponding expected file in expectedDir
        generatedFiles.forEach(file => {
          const generatedFilePath = path.join(mockDir, file);
          const expectedFilePath = path.join(expectedDir, file);

          compareGeneratedToExpected(generatedFilePath, expectedFilePath);
        });

        // Verify stdout output
        expect(stdout).toContain("✅ Generated");

        // Complete the test
        done();
      });
    });

    test(`should skip post-processing for ${name} when using --noPost`, done => {
      // Run the CLI command without the --noPost flag
      runCliCommand(["crd", mockYamlPath, mockDir, "--noPost"], (error, stdout) => {
        expect(error).toBeNull(); // Ensure no errors occurred

        // Ensure post-processing was not run (stdout should reflect this)
        expect(stdout).not.toContain("🔧 Post-processing started");

        // Complete the test
        done();
      });
    });

    test(`should skip post-processing for ${name} when using --noPost`, done => {
      // Run the CLI command without post-processing
      runCliCommand(["crd", mockYamlPath, mockDir, "--noPost"], (error, stdout) => {
        expect(error).toBeNull(); // Ensure no errors occurred

        // Get the list of generated files
        const generatedFiles = fs.readdirSync(mockDir);

        // Compare each generated file to the corresponding expected file in expectedPostDir
        generatedFiles.forEach(file => {
          const generatedFilePath = path.join(mockDir, file);
          const expectedFilePath = path.join(expectedPostDir, file);

          compareGeneratedToExpected(generatedFilePath, expectedFilePath);
        });

        // Ensure post-processing was not run (stdout should reflect this)
        expect(stdout).not.toContain("🔧 Post-processing started");

        // Complete the test
        done();
      });
    });
  });
});
