// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { watch } from "chokidar";
import { promises as fs } from "fs";
import { resolve } from "path";
import { prompt } from "prompts";
import { Webhook } from "../../src/lib/k8s/webhook";
import Log from "../../src/lib/logger";
import { buildModule } from "./build";
import { RootCmd } from "./root";

export default function (program: RootCmd) {
  program
    .command("dev")
    .description("Setup a local webhook development environment")
    .option("-h, --host [host]", "Host to listen on", "host.docker.internal")
    .option("--confirm", "Skip confirmation prompt")
    .action(async opts => {
      // Prompt the user to confirm if they didn't pass the --confirm flag
      if (!opts.confirm) {
        const confirm = await prompt({
          type: "confirm",
          name: "confirm",
          message: "This will remove and redeploy the module. Continue?",
        });

        // Exit if the user doesn't confirm
        if (!confirm.confirm) {
          process.exit(0);
        }
      }

      // Build the module
      const { cfg, path } = await buildModule();

      // Read the compiled module code
      const code = await fs.readFile(path);

      // Generate a secret for the module
      const webhook = new Webhook(
        {
          ...cfg.pepr,
          description: cfg.description,
        },
        opts.host
      );

      // Write the TLS cert and key to disk
      await fs.writeFile("insecure-tls.crt", webhook.tls.pem.crt);
      await fs.writeFile("insecure-tls.key", webhook.tls.pem.key);

      try {
        await webhook.deploy(code);
        Log.info(`Module deployed successfully`);

        const moduleFiles = resolve(".", "**", "*.ts");
        const watcher = watch(moduleFiles);
        const peprTS = resolve(".", "pepr.ts");
        let program: ChildProcessWithoutNullStreams;

        // Run the module once to start the server
        runDev(peprTS);

        // Watch for changes
        watcher.on("ready", () => {
          Log.info(`Watching for changes in ${moduleFiles}`);
          watcher.on("all", async (event, path) => {
            Log.debug({ event, path }, "File changed");

            // Kill the running process
            if (program) {
              program.kill("SIGKILL");
            }

            // Start the process again
            program = runDev(peprTS);
          });
        });
      } catch (e) {
        Log.error(`Error deploying module: ${e}`);
        process.exit(1);
      }
    });
}

function runDev(path: string) {
  try {
    const program = spawn("./node_modules/.bin/ts-node", [path], {
      env: {
        ...process.env,
        LOG_LEVEL: "debug",
        SSL_KEY_PATH: "insecure-tls.key",
        SSL_CERT_PATH: "insecure-tls.crt",
      },
    });

    program.stdout.on("data", data => console.log(data.toString()));
    program.stderr.on("data", data => console.error(data.toString()));

    program.on("close", code => {
      Log.info(`Process exited with code ${code}`);
    });

    return program;
  } catch (e) {
    Log.debug(e);
    Log.error(`Error running module: ${e}`);
    process.exit(1);
  }
}
