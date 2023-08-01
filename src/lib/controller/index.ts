// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import express, { NextFunction } from "express";
import fs from "fs";
import https from "https";

import { Capability } from "../capability";
import { MutateResponse, Request, ValidateResponse } from "../k8s/types";
import Log from "../logger";
import { MetricsCollector } from "../metrics";
import { mutateProcessor } from "../mutate-processor";
import { ModuleConfig } from "../types";
import { validateProcessor } from "../validate-processor";
import { PeprControllerStore } from "./store";

// If the hostname is pepr-static-test-watcher-0, then we are running in watch mode
const isWatchMode = process.env.PEPR_WATCH_MODE === "true";

export class Controller {
  private readonly _app = express();
  private _running = false;
  private metricsCollector = new MetricsCollector("pepr");

  // The token used to authenticate requests
  private _token = "";

  constructor(
    private readonly _config: ModuleConfig,
    private readonly _capabilities: Capability[],
    private readonly _beforeHook?: (req: Request) => void,
    private readonly _afterHook?: (res: MutateResponse) => void,
  ) {
    // Middleware for logging requests
    this._app.use(this.logger);

    // Middleware for parsing JSON, limit to 2mb vs 100K for K8s compatibility
    this._app.use(express.json({ limit: "2mb" }));

    // Initialize the Pepr store for each capability
    new PeprControllerStore(_config, _capabilities, () => {
      // Bind the endpoints after the store is ready
      this.bindEndpoints();
    });

    if (_beforeHook) {
      Log.info(`Using beforeHook: ${_beforeHook}`);
    }

    if (_afterHook) {
      Log.info(`Using afterHook: ${_afterHook}`);
    }
  }

  private bindEndpoints = () => {
    // Health check endpoint
    this._app.get("/healthz", this.healthz);

    // Metrics endpoint
    this._app.get("/metrics", this.metrics);

    if (isWatchMode) {
      return;
    }

    // Require auth for webhook endpoints
    this._app.use(["/mutate/:token", "/validate/:token"], this.validateToken);

    // Mutate endpoint
    this._app.post("/mutate/:token", this.admissionReq("Mutate"));

    // Validate endpoint
    this._app.post("/validate/:token", this.admissionReq("Validate"));
  };

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

    // Get the API token if not in watch mode
    if (!isWatchMode) {
      // Get the API token from the environment variable or the mounted secret
      this._token = process.env.PEPR_API_TOKEN || fs.readFileSync("/app/api-token/value").toString().trim();
      Log.info(`Using API token: ${this._token}`);

      if (!this._token) {
        throw new Error("API token not found");
      }
    }

    // Create HTTPS server
    const server = https.createServer(options, this._app).listen(port);

    // Handle server listening event
    server.on("listening", () => {
      Log.info(`Server listening on port ${port}`);
      // Track that the server is running
      this._running = true;
    });

    // Handle EADDRINUSE errors
    server.on("error", (e: { code: string }) => {
      if (e.code === "EADDRINUSE") {
        Log.warn(
          `Address in use, retrying in 2 seconds. If this persists, ensure ${port} is not in use, e.g. "lsof -i :${port}"`,
        );
        setTimeout(() => {
          server.close();
          server.listen(port);
        }, 2000);
      }
    });

    // Listen for the SIGTERM signal and gracefully close the server
    process.on("SIGTERM", () => {
      Log.info("Received SIGTERM, closing server");
      server.close(() => {
        Log.info("Server closed");
        process.exit(0);
      });
    });
  };

  /**
   * Middleware for logging requests
   *
   * @param req the incoming request
   * @param res the outgoing response
   * @param next the next middleware function
   */
  private logger = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const startTime = Date.now();

    res.on("finish", () => {
      const now = new Date().toISOString();
      const elapsedTime = Date.now() - startTime;
      const message = `[${now}] ${req.method} ${req.originalUrl} [${res.statusCode}] ${elapsedTime} ms\n`;

      res.statusCode >= 400 ? Log.warn(message) : Log.info(message);
    });

    next();
  };

  /**
   * Validate the token in the request path
   *
   * @param req The incoming request
   * @param res The outgoing response
   * @param next The next middleware function
   * @returns
   */
  private validateToken = (req: express.Request, res: express.Response, next: NextFunction) => {
    // Validate the token
    const { token } = req.params;
    if (token !== this._token) {
      const err = `Unauthorized: invalid token '${token.replace(/[^\w]/g, "_")}'`;
      Log.warn(err);
      res.status(401).send(err);
      this.metricsCollector.alert();
      return;
    }

    // Token is valid, continue
    next();
  };

  /**
   * Health check endpoint handler
   *
   * @param req the incoming request
   * @param res the outgoing response
   */
  private healthz = (req: express.Request, res: express.Response) => {
    try {
      res.send("OK");
    } catch (err) {
      Log.error(err);
      res.status(500).send("Internal Server Error");
    }
  };

  /**
   * Metrics endpoint handler
   *
   * @param req the incoming request
   * @param res the outgoing response
   */
  private metrics = async (req: express.Request, res: express.Response) => {
    try {
      res.send(await this.metricsCollector.getMetrics());
    } catch (err) {
      Log.error(err);
      res.status(500).send("Internal Server Error");
    }
  };

  /**
   * Admission request handler for both mutate and validate requests
   *
   * @param admissionKind the type of admission request
   * @returns the request handler
   */
  private admissionReq = (admissionKind: "Mutate" | "Validate") => {
    // Create the admission request handler
    return async (req: express.Request, res: express.Response) => {
      // Start the metrics timer
      const startTime = this.metricsCollector.observeStart();

      try {
        // Get the request from the body or create an empty request
        const request: Request = req.body?.request || ({} as Request);

        // Run the before hook if it exists
        this._beforeHook && this._beforeHook(request || {});

        // Setup identifiers for logging
        const name = request?.name ? `/${request.name}` : "";
        const namespace = request?.namespace || "";
        const gvk = request?.kind || { group: "", version: "", kind: "" };
        const prefix = `${request.uid} ${namespace}${name}`;

        Log.info(`${admissionKind} [${request.operation}] ${gvk.group}/${gvk.version}/${gvk.kind}`, prefix);

        // Process the request
        let response: MutateResponse | ValidateResponse;

        // Call mutate or validate based on the admission kind
        if (admissionKind === "Mutate") {
          response = await mutateProcessor(this._config, this._capabilities, request, prefix);
        } else {
          response = await validateProcessor(this._capabilities, request, prefix);
        }

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
        Log.error(err);
        res.status(500).send("Internal Server Error");
        this.metricsCollector.error();
      }
    };
  };
}
