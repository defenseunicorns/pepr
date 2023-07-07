// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import express from "express";
import fs from "fs";
import https from "https";

import { Capability } from "./capability";
import { a } from "./k8s";
import { Request, MutateResponse } from "./k8s/types";
import Log from "./logger";
import { MetricsCollector } from "./metrics";
import { mutateProcessor } from "./mutate-processor";
import { ModuleConfig, PeprState } from "./types";
import { After } from "./watch";

export class Controller {
  private readonly _app = express();
  private _running = false;
  private metricsCollector = new MetricsCollector("pepr");

  // The token used to authenticate requests
  private _token = "";

  private _peprState: PeprState = {};

  constructor(
    private readonly _config: ModuleConfig,
    private readonly _capabilities: Capability[],
    private readonly _beforeHook?: (req: Request) => void,
    private readonly _afterHook?: (res: MutateResponse) => void
  ) {
    // Middleware for logging requests
    this._app.use(this.logger);

    // Middleware for parsing JSON, limit to 2mb vs 100K for K8s compatibility
    this._app.use(express.json({ limit: "2mb" }));

    // Health check endpoint
    this._app.get("/healthz", this.healthz);

    // Metrics endpoint
    this._app.get("/metrics", this.metrics);

    // Mutate endpoint
    this._app.post("/mutate/:token", this.mutate);

    if (_beforeHook) {
      console.info(`Using beforeHook: ${_beforeHook}`);
    }

    if (_afterHook) {
      console.info(`Using afterHook: ${_afterHook}`);
    }

    // Setup Pepr State bindings
    After(a.ConfigMap)
      .IsCreatedOrUpdated()
      .InNamespace("pepr-system")
      .Observe(cm => {
        console.log(cm);

        const name = cm.metadata?.name;

        if (name && cm.data) {
          this._peprState[name] = cm.data;
        } else {
          console.error(`Invalid pepr state cm`);
        }
      });
  }

  /** Start the webhook server */
  public startServer = (port: number) => {
    if (this._running) {
      throw new Error("Cannot start Pepr module: Pepr module was not instantiated with deferStart=true");
    }

    // Load SSL certificate and key
    const options = {
      key: fs.readFileSync(process.env.SSL_KEY_PATH || "/etc/certs/tls.key"),
      cert: fs.readFileSync(process.env.SSL_CERT_PATH || "/etc/certs/tls.crt"),
    };

    // Get the API token from the environment variable or the mounted secret
    this._token = process.env.PEPR_API_TOKEN || fs.readFileSync("/app/api-token/value").toString().trim();
    console.info(`Using API token: ${this._token}`);

    if (!this._token) {
      throw new Error("API token not found");
    }

    // Create HTTPS server
    const server = https.createServer(options, this._app).listen(port);

    // Handle server listening event
    server.on("listening", () => {
      console.log(`Server listening on port ${port}`);
      // Track that the server is running
      this._running = true;
    });

    // Handle EADDRINUSE errors
    server.on("error", (e: { code: string }) => {
      if (e.code === "EADDRINUSE") {
        console.log(
          `Address in use, retrying in 2 seconds. If this persists, ensure ${port} is not in use, e.g. "lsof -i :${port}"`
        );
        setTimeout(() => {
          server.close();
          server.listen(port);
        }, 2000);
      }
    });

    // Listen for the SIGTERM signal and gracefully close the server
    process.on("SIGTERM", () => {
      console.log("Received SIGTERM, closing server");
      server.close(() => {
        console.log("Server closed");
        process.exit(0);
      });
    });
  };

  private logger = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const startTime = Date.now();

    res.on("finish", () => {
      const now = new Date().toISOString();
      const elapsedTime = Date.now() - startTime;
      const message = `[${now}] ${req.method} ${req.originalUrl} [${res.statusCode}] ${elapsedTime} ms\n`;

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

  private metrics = async (req: express.Request, res: express.Response) => {
    try {
      res.send(await this.metricsCollector.getMetrics());
    } catch (err) {
      console.error(err);
      res.status(500).send("Internal Server Error");
    }
  };

  private mutate = async (req: express.Request, res: express.Response) => {
    const startTime = this.metricsCollector.observeStart();

    try {
      // Validate the token
      const { token } = req.params;
      if (token !== this._token) {
        const err = `Unauthorized: invalid token '${token.replace(/[^\w]/g, "_")}'`;
        console.warn(err);
        res.status(401).send(err);
        this.metricsCollector.alert();
        return;
      }

      const request: Request = req.body?.request || ({} as Request);

      // Run the before hook if it exists
      this._beforeHook && this._beforeHook(request || {});

      const name = request?.name ? `/${request.name}` : "";
      const namespace = request?.namespace || "";
      const gvk = request?.kind || { group: "", version: "", kind: "" };
      const prefix = `${request.uid} ${namespace}${name}`;

      Log.info(`Mutate [${request.operation}] ${gvk.group}/${gvk.version}/${gvk.kind}`, prefix);

      // Process the request
      const response = await mutateProcessor(this._config, this._capabilities, request, prefix);

      // Run the after hook if it exists
      this._afterHook && this._afterHook(response);

      // Log the response
      Log.debug(response, prefix);

      // Send a no prob bob response
      res.send({
        apiVersion: "admission.k8s.io/v1",
        kind: "AdmissionReview",
        response,
      });
      this.metricsCollector.observeEnd(startTime);
    } catch (err) {
      console.error(err);
      res.status(500).send("Internal Server Error");
      this.metricsCollector.error();
    }
  };
}
