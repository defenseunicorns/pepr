// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import express from "express";
import fs from "fs";
import https from "https";
import { Capability } from "./capability";
import { Request, Response } from "./k8s/types";
import { processor } from "./processor";
import { ModuleConfig } from "./types";

// Load SSL certificate and key
const options = {
  key: fs.readFileSync(process.env.SSL_KEY_PATH || "/etc/certs/tls.key"),
  cert: fs.readFileSync(process.env.SSL_CERT_PATH || "/etc/certs/tls.crt"),
};

export class Controller {
  private readonly app = express();
  private running = false;

  constructor(
    private readonly config: ModuleConfig,
    private readonly capabilities: Capability[],
    private readonly beforeHook?: (req: Request) => void,
    private readonly afterHook?: (res: Response) => void
  ) {
    // Middleware for logging requests
    this.app.use(this.logger);

    // Middleware for parsing JSON
    this.app.use(express.json());

    // Health check endpoint
    this.app.get("/healthz", this.healthz);

    // Mutate endpoint
    this.app.post("/mutate", this.mutate);

    if (beforeHook) {
      console.info(`Using beforeHook: ${beforeHook}`);
    }

    if (afterHook) {
      console.info(`Using afterHook: ${afterHook}`);
    }
  }

  /** Start the webhook server */
  public startServer = (port: number) => {
    if (this.running) {
      throw new Error("Cannot start Pepr module: Pepr module was not instantiated with deferStart=true");
    }

    // Create HTTPS server
    https.createServer(options, this.app).listen(port, () => {
      console.log(`Server listening on port ${port}`);
      // Track that the server is running
      this.running = true;
    });
  };

  private logger = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const startTime = Date.now();

    res.on("finish", () => {
      const now = new Date().toISOString();
      const elapsedTime = Date.now() - startTime;
      const message = `[${now}] ${req.method} ${req.originalUrl} - ${res.statusCode} - ${elapsedTime} ms\n`;

      res.statusCode >= 400 ? console.error(message) : console.info(message);
    });

    next();
  };

  private healthz = (req: express.Request, res: express.Response) => {
    try {
      res.send("OK");
    } catch (err) {
      console.error(err);
      res.status(500).send("Internal Server Error");
    }
  };

  private mutate = async (req: express.Request, res: express.Response) => {
    try {
      // Run the before hook if it exists
      this.beforeHook && this.beforeHook(req.body?.request || {});

      const name = req.body?.request?.name || "";
      const namespace = req.body?.request?.namespace || "";
      const gvk = req.body?.request?.kind || { group: "", version: "", kind: "" };

      console.log(`Mutate request: ${gvk.group}/${gvk.version}/${gvk.kind}`);
      name && console.log(`                ${namespace}/${name}\n`);

      // Process the request
      const response = await processor(this.config, this.capabilities, req.body.request);

      // Run the after hook if it exists
      this.afterHook && this.afterHook(response);

      // Log the response
      console.debug(response);

      // Send a no prob bob response
      res.send({
        apiVersion: "admission.k8s.io/v1",
        kind: "AdmissionReview",
        response,
      });
    } catch (err) {
      console.error(err);
      res.status(500).send("Internal Server Error");
    }
  };
}
