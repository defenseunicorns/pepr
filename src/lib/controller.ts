// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import express from "express";
import fs from "fs";
import https from "https";
import { ModuleConfig } from "./types";
import { Capability } from "./capability";
import { processor } from "./processor";

// Load SSL certificate and key
const options = {
  key: fs.readFileSync(process.env.SSL_KEY_PATH || "/etc/certs/tls.key"),
  cert: fs.readFileSync(process.env.SSL_CERT_PATH || "/etc/certs/tls.crt"),
};

export class Controller {
  private readonly app = express();

  constructor(private readonly config: ModuleConfig, private readonly capabilities: Capability[]) {
    // Middleware for logging requests
    this.app.use(this.logger);

    // Middleware for parsing JSON
    this.app.use(express.json());

    // Health check endpoint
    this.app.get("/healthz", this.healthz);

    // Mutate endpoint
    this.app.post("/mutate", this.mutate);
  }

  /** Start the webhook server */
  public startServer = (port: number) => {
    // Create HTTPS server
    https.createServer(options, this.app).listen(port, () => {
      console.log(`Server listening on port ${port}`);
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

  private mutate = (req: express.Request, res: express.Response) => {
    try {
      const name = req.body?.request?.name || "";
      const namespace = req.body?.request?.namespace || "";
      const gvk = req.body?.request?.kind || { group: "", version: "", kind: "" };

      console.log(`Mutate request: ${gvk.group}/${gvk.version}/${gvk.kind}`);
      name && console.log(`                ${namespace}/${name}\n`);

      const response = processor(this.config, this.capabilities, req.body.request);
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
