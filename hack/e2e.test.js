/* eslint-disable */
const test = require("ava");
const { spawn } = require("child_process");

const TIMEOUT = 30 * 000; // Timeout in milliseconds

let expectedLines = [
  "Establishing connection to Kubernetes",
  "Capability hello-pepr registered",
  "[info]\t\thello-pepr: V1ConfigMap Binding created",
  "[info]\t\thello-pepr: V1ConfigMap Binding action created",
  "Server listening on port 3000",
];

function stripAnsiCodes(input) {
  return input.replace(/\u001B\[[0-9;]*[a-zA-Z]/g, "");
}

function runCommand(command, args, timeout) {
  return new Promise((resolve, reject) => {
    const cmd = spawn(command, args, { cwd: "pepr-test-module" });

    cmd.stdout.on("data", data => {
      // Convert buffer to string
      data = stripAnsiCodes(data.toString());
      console.log(data);
      // Check if any expected lines are found
      expectedLines = expectedLines.filter(expectedLine => {
        const match = data.includes(expectedLine);
        if (match) {
          console.log(`Found expected line: ${expectedLine}`);
        }
        return !match;
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
      reject(new Error("Command exited before finding all expected lines."));
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
    }, timeout);
  });
}

test("E2E: Pepr Dev", async t => {
  await t.notThrowsAsync(() => runCommand("pepr", ["dev", "--confirm"], TIMEOUT));
});
