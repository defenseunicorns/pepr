// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import express, { NextFunction } from "express";
import fs from "fs";
import https from "https";

import { Capability } from "../capability";
import { MutateResponse, AdmissionRequest, ValidateResponse } from "../k8s";
import Log from "../logger";
import { MetricsCollector } from "../metrics";
import { ModuleConfig, isWatchMode } from "../module";
import { mutateProcessor } from "../mutate-processor";
import { validateProcessor } from "../validate-processor";
import { PeprControllerStore } from "./store";
import { ResponseItem } from "../types";

export class Controller {
  // Track whether the server is running
  #running = false;

  // Metrics collector
  #metricsCollector = new MetricsCollector("pepr");

  // The token used to authenticate requests
  #token = "";

  // The express app instance
  readonly #app = express();

  // Initialized with the constructor
  readonly #config: ModuleConfig;
  readonly #capabilities: Capability[];
  readonly #beforeHook?: (req: AdmissionRequest) => void;
  readonly #afterHook?: (res: MutateResponse) => void;

  constructor(
    config: ModuleConfig,
    capabilities: Capability[],
    beforeHook?: (req: AdmissionRequest) => void,
    afterHook?: (res: MutateResponse) => void,
    onReady?: () => void,
  ) {
    this.#config = config;
    this.#capabilities = capabilities;

    // Initialize the Pepr store for each capability
    new PeprControllerStore(capabilities, `pepr-${config.uuid}-store`, () => {
      this.#bindEndpoints();
      onReady && onReady();
      Log.info("✅ Controller startup complete");
      // Initialize the schedule store for each capability
      new PeprControllerStore(capabilities, `pepr-${config.uuid}-schedule`, () => {
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
  startServer = (port: number) => {
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

  #bindEndpoints = () => {
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
  #validateToken = (req: express.Request, res: express.Response, next: NextFunction) => {
    // Validate the token
    const { token } = req.params;
    if (token !== this.#token) {
      const err = `Unauthorized: invalid token '${token.replace(/[^\w]/g, "_")}'`;
      Log.warn(err);
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
  #metrics = async (req: express.Request, res: express.Response) => {
    try {
      res.send(await this.#metricsCollector.getMetrics());
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
  #admissionReq = (admissionKind: "Mutate" | "Validate") => {
    // Create the admission request handler
    return async (req: express.Request, res: express.Response) => {
      // Start the metrics timer
      const startTime = MetricsCollector.observeStart();

      try {
        // Get the request from the body or create an empty request
        const request: AdmissionRequest = req.body?.request || ({} as AdmissionRequest);

        // Run the before hook if it exists
        this.#beforeHook && this.#beforeHook(request || {});

        // Setup identifiers for logging
        const name = request?.name ? `/${request.name}` : "";
        const namespace = request?.namespace || "";
        const gvk = request?.kind || { group: "", version: "", kind: "" };

        const reqMetadata = {
          uid: request.uid,
          namespace,
          name,
        };

        Log.info({ ...reqMetadata, gvk, operation: request.operation, admissionKind }, "Incoming request");
        Log.debug({ ...reqMetadata, request }, "Incoming request body");

        // Process the request
        let response: MutateResponse | ValidateResponse[];

        // Call mutate or validate based on the admission kind
        if (admissionKind === "Mutate") {
          response = await mutateProcessor(this.#config, this.#capabilities, request, reqMetadata);
        } else {
          response = await validateProcessor(this.#capabilities, request, reqMetadata);
        }

        // Run the after hook if it exists
        const responseList: ValidateResponse[] | MutateResponse[] = Array.isArray(response) ? response : [response];
        responseList.map(res => {
          this.#afterHook && this.#afterHook(res);
          // Log the response
          Log.debug({ ...reqMetadata, res }, "Check response");
        });

        let kubeAdmissionResponse: ValidateResponse[] | MutateResponse | ResponseItem;

        if (admissionKind === "Mutate") {
          kubeAdmissionResponse = response;
          Log.debug({ ...reqMetadata, response }, "Outgoing response");
          res.send({
            apiVersion: "admission.k8s.io/v1",
            kind: "AdmissionReview",
            response: kubeAdmissionResponse,
          });
        } else {
          kubeAdmissionResponse = {
            uid: responseList[0].uid,
            allowed: responseList.filter(r => !r.allowed).length === 0,
            status: {
              message: (responseList as ValidateResponse[])
                .filter(rl => !rl.allowed)
                .map(curr => curr.status?.message)
                .join("; "),
            },
          };
          res.send({
            apiVersion: "admission.k8s.io/v1",
            kind: "AdmissionReview",
            response: kubeAdmissionResponse,
          });
        }

        Log.debug({ ...reqMetadata, kubeAdmissionResponse }, "Outgoing response");

        this.#metricsCollector.observeEnd(startTime, admissionKind);
      } catch (err) {
        Log.error(err);
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
  static #logger(req: express.Request, res: express.Response, next: express.NextFunction) {
    const startTime = Date.now();

    res.on("finish", () => {
      const elapsedTime = Date.now() - startTime;
      const message = {
        uid: req.body?.request?.uid,
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${elapsedTime} ms`,
      };

      res.statusCode >= 300 ? Log.warn(message) : Log.info(message);
    });

    next();
  }
  /**
   * Health check endpoint handler
   *
   * @param req the incoming request
   * @param res the outgoing response
   */
  static #healthz(req: express.Request, res: express.Response) {
    try {
      res.send("OK");
    } catch (err) {
      Log.error(err);
      res.status(500).send("Internal Server Error");
    }
  }
}
