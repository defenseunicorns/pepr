// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import express, { NextFunction } from "express";
import fs from "fs";
import https from "https";

import { Capability } from "../core/capability";
import { MutateResponse, ValidateResponse } from "../k8s";
import Log from "../telemetry/logger";
import { metricsCollector, MetricsCollector } from "../telemetry/metrics";
import { isWatchMode } from "../core/envChecks";
import { ModuleConfig } from "../types";
import { mutateProcessor } from "../processors/mutate-processor";
import { validateProcessor } from "../processors/validate-processor";
import { StoreController } from "./store";
import { AdmissionRequest } from "../types";
import { karForMutate, karForValidate, KubeAdmissionReview } from "./index.util";

export interface ControllerHooks {
  beforeHook?: (req: AdmissionRequest) => void;
  afterHook?: (res: MutateResponse | ValidateResponse) => void;
  onReady?: () => void;
}

if (!process.env.PEPR_NODE_WARNINGS) {
  process.removeAllListeners("warning");
}

export class Controller {
  // Track whether the server is running
  #running = false;

  // Metrics collector
  #metricsCollector = metricsCollector;

  // The token used to authenticate requests
  #token = "";

  // The express app instance
  readonly #app = express();

  // Initialized with the constructor
  readonly #config: ModuleConfig;
  readonly #capabilities: Capability[];
  readonly #beforeHook?: (req: AdmissionRequest) => void;
  readonly #afterHook?: (res: MutateResponse | ValidateResponse) => void;

  constructor(config: ModuleConfig, capabilities: Capability[], hooks: ControllerHooks = {}) {
    const { beforeHook, afterHook, onReady } = hooks;
    this.#config = config;
    this.#capabilities = capabilities;

    // Initialize the Pepr store for each capability
    new StoreController(capabilities, `pepr-${config.uuid}-store`, () => {
      this.#bindEndpoints();
      if (typeof onReady === "function") {
        onReady();
      }
      Log.info("✅ Controller startup complete");
      // Initialize the schedule store for each capability
      new StoreController(capabilities, `pepr-${config.uuid}-schedule`, () => {
        Log.info("✅ Scheduling processed");
      });
    });

    // Middleware for logging requests
    this.#app.use(Controller.#logger);

    // Middleware for parsing JSON, limit to 2mb vs 100K for K8s compatibility
    this.#app.use(express.json({ limit: "2mb" }));

    if (beforeHook) {
      Log.info(`Using beforeHook: ${beforeHook}`);
      this.#beforeHook = beforeHook;
    }

    if (afterHook) {
      Log.info(`Using afterHook: ${afterHook}`);
      this.#afterHook = afterHook;
    }
  }

  /** Start the webhook server */
  startServer = (port: number): void => {
    if (this.#running) {
      throw new Error("Cannot start Pepr module: Pepr module was not instantiated with deferStart=true");
    }

    // Load SSL certificate and key
    const options = {
      key: fs.readFileSync(process.env.SSL_KEY_PATH || "/etc/certs/tls.key"),
      cert: fs.readFileSync(process.env.SSL_CERT_PATH || "/etc/certs/tls.crt"),
    };

    // Get the API token if not in watch mode
    if (!isWatchMode()) {
      // Get the API token from the environment variable or the mounted secret
      this.#token = process.env.PEPR_API_TOKEN || fs.readFileSync("/app/api-token/value").toString().trim();
      Log.info(`Using API token: ${this.#token}`);

      if (!this.#token) {
        throw new Error("API token not found");
      }
    }

    // Create HTTPS server
    const server = https.createServer(options, this.#app).listen(port);

    // Handle server listening event
    server.on("listening", () => {
      Log.info(`Server listening on port ${port}`);
      // Track that the server is running
      this.#running = true;
    });

    // Handle EADDRINUSE errors
    server.on("error", (e: { code: string }) => {
      if (e.code === "EADDRINUSE") {
        Log.info(
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

  #bindEndpoints = (): void => {
    // Health check endpoint
    this.#app.get("/healthz", Controller.#healthz);

    // Metrics endpoint
    this.#app.get("/metrics", this.#metrics);

    if (isWatchMode()) {
      return;
    }

    // Require auth for webhook endpoints
    this.#app.use(["/mutate/:token", "/validate/:token"], this.#validateToken);

    // Mutate endpoint
    this.#app.post("/mutate/:token", this.#admissionReq("Mutate"));

    // Validate endpoint
    this.#app.post("/validate/:token", this.#admissionReq("Validate"));
  };

  /**
   * Validate the token in the request path
   *
   * @param req The incoming request
   * @param res The outgoing response
   * @param next The next middleware function
   * @returns
   */
  #validateToken = (req: express.Request, res: express.Response, next: NextFunction): void => {
    // Validate the token
    const { token } = req.params;
    if (token !== this.#token) {
      const err = `Unauthorized: invalid token '${token.replace(/[^\w]/g, "_")}'`;
      Log.info(err);
      res.status(401).send(err);
      this.#metricsCollector.alert();
      return;
    }

    // Token is valid, continue
    next();
  };

  /**
   * Metrics endpoint handler
   *
   * @param req the incoming request
   * @param res the outgoing response
   */
  #metrics = async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      // https://github.com/prometheus/docs/blob/main/content/docs/instrumenting/exposition_formats.md#basic-info
      res.set("Content-Type", "text/plain; version=0.0.4");
      res.send(await this.#metricsCollector.getMetrics());
    } catch (err) {
      Log.error(err, `Error getting metrics`);
      res.status(500).send("Internal Server Error");
    }
  };

  /**
   * Admission request handler for both mutate and validate requests
   *
   * @param admissionKind the type of admission request
   * @returns the request handler
   */
  #admissionReq = (
    admissionKind: "Mutate" | "Validate",
  ): ((req: express.Request, res: express.Response) => Promise<void>) => {
    // Create the admission request handler
    return async (req: express.Request, res: express.Response) => {
      // Start the metrics timer
      const startTime = MetricsCollector.observeStart();

      try {
        // Get the request from the body or create an empty request
        const request: AdmissionRequest = req.body?.request || ({} as AdmissionRequest);

        const { name, namespace, gvk } = {
          name: request?.name ? `/${request.name}` : "",
          namespace: request?.namespace || "",
          gvk: request?.kind || { group: "", version: "", kind: "" },
        };

        const reqMetadata = { uid: request.uid, namespace, name };
        Log.info({ ...reqMetadata, gvk, operation: request.operation, admissionKind }, "Incoming request");
        Log.debug({ ...reqMetadata, request }, "Incoming request body");

        // Run the before hook if it exists
        if (typeof this.#beforeHook === "function") {
          this.#beforeHook(request || {});
        }

        // Process the request
        const response: MutateResponse | ValidateResponse[] =
          admissionKind === "Mutate"
            ? await mutateProcessor(this.#config, this.#capabilities, request, reqMetadata)
            : await validateProcessor(this.#config, this.#capabilities, request, reqMetadata);

        // Run the after hook if it exists
        [response].flat().map(res => {
          if (typeof this.#afterHook === "function") {
            this.#afterHook(res);
          }
          Log.info({ ...reqMetadata, res }, "Check response");
        });

        const kar: KubeAdmissionReview =
          admissionKind === "Mutate"
            ? karForMutate(response as MutateResponse)
            : karForValidate(request, response as ValidateResponse[]);

        Log.debug({ ...reqMetadata, kubeAdmissionResponse: kar.response }, "Outgoing response");
        res.send(kar);

        this.#metricsCollector.observeEnd(startTime, admissionKind);
      } catch (err) {
        Log.error(err, `Error processing ${admissionKind} request`);
        res.status(500).send("Internal Server Error");
        this.#metricsCollector.error();
      }
    };
  };

  /**
   * Middleware for logging requests
   *
   * @param req the incoming request
   * @param res the outgoing response
   * @param next the next middleware function
   */
  static #logger(req: express.Request, res: express.Response, next: express.NextFunction): void {
    const startTime = Date.now();

    res.on("finish", () => {
      const excludedRoutes = ["/healthz", "/metrics"];
      if (excludedRoutes.includes(req.originalUrl)) {
        return;
      }

      const elapsedTime = Date.now() - startTime;
      const message = {
        uid: req.body?.request?.uid,
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${elapsedTime} ms`,
      };

      Log.info(message);
    });

    next();
  }
  /**
   * Health check endpoint handler
   *
   * @param req the incoming request
   * @param res the outgoing response
   */
  static #healthz(req: express.Request, res: express.Response): void {
    try {
      res.send("OK");
    } catch (err) {
      Log.error(err, `Error processing health check`);
      res.status(500).send("Internal Server Error");
    }
  }
}
