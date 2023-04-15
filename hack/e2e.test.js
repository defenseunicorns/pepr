/* eslint-disable */
const test = require("ava");
const fs = require("fs").promises;
const path = require("path");
const { spawn, execSync } = require("child_process");

// Timeout in milliseconds
const TIMEOUT = 30 * 1000;
const testDir = "pepr-test-module";

let expectedLines = [
  "Establishing connection to Kubernetes",
  "Capability hello-pepr registered",
  "hello-pepr: V1ConfigMap Binding created",
  "hello-pepr: V1ConfigMap Binding action created",
  "Server listening on port 3000",
];

function stripAnsiCodes(input) {
  return input.replace(/\u001B\[[0-9;]*[a-zA-Z]/g, "");
}

test.before(async t => {
  const dir = path.resolve(testDir);

  try {
    await fs.access(dir);
    await fs.rm(dir, { recursive: true, force: true });
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
      // The directory does not exist, do nothing
    }
  }
});

test("E2E: Pepr Init", async t => {
  try {
    execSync("TEST_MODE=true pepr init", { stdio: "inherit" });
    t.pass();
  } catch (e) {
    t.fail(e.message);
  }
});

test("E2E: Pepr Build", async t => {
  try {
    execSync("pepr build", { cwd: testDir, stdio: "inherit" });
    t.pass();
  } catch (e) {
    t.fail(e.message);
  }
});

test("E2E: Pepr Dev", async t => {
  await t.notThrowsAsync(new Promise(peprDev));
});

function peprDev(resolve, reject) {
  const cmd = spawn("pepr", ["dev", "--confirm"], { cwd: testDir });

  cmd.stdout.on("data", data => {
    // Convert buffer to string
    data = stripAnsiCodes(data.toString());
    console.log(data);

    // Check if any expected lines are found
    expectedLines = expectedLines.filter(expectedLine => {
      // Check if the expected line is found in the output, ignoring whitespace
      return !data.replace(/\s+/g, ' ').includes(expectedLine);
    });

    // If all expected lines are found, resolve the promise
    if (expectedLines.length < 1) {
      cmd.kill();
      resolve();
    }
  });

  // Log stderr
  cmd.stderr.on("data", data => {
    console.error(`stderr: ${data}`);
  });

  // This command should not exit on its own
  cmd.on("close", code => {
    reject(new Error(`Command exited with code ${code}`));
  });

  // Reject on error
  cmd.on("error", error => {
    reject(error);
  });

  // Reject on timeout
  setTimeout(() => {
    console.error("Remaining expected lines:" + JSON.stringify(expectedLines, null, 2));
    cmd.kill();
    reject(new Error("Timeout: Expected lines not found"));
  }, TIMEOUT);
}
