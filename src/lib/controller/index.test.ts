// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import request from "supertest";
import express from "express";
import { Socket } from "net";
//import https from 'https';
import { Controller } from "./index";
import { Capability } from "../capability";
import { ModuleConfig } from "../module";
import { jest, it, describe, expect, beforeEach } from "@jest/globals";
import { metricsCollector } from "../metrics";
import Log from "../logger";
//import { mutateProcessor } from '../mutate-processor';
//import { validateProcessor } from '../validate-processor';

jest.mock("../mutate-processor", () => ({
  mutateProcessor: jest.fn(),
}));

jest.mock("../validate-processor", () => ({
  validateProcessor: jest.fn(),
}));

jest.mock("https", () => ({
  createServer: jest.fn().mockReturnValue({
    listen: jest.fn().mockImplementation((...args: unknown[]) => {
      const callback = args.find(arg => typeof arg === "function") as () => void;
      if (callback) callback();
      return {
        on: jest.fn((event: string, handler: (socket: Socket) => void) => {
          if (event === "timeout") {
            const mockSocket = new Socket(); // Simulate a socket
            handler(mockSocket); // Trigger the timeout event
          }
        }),
      };
    }),
  }),
}));

jest.mock("fs", () => ({
  ...(jest.requireActual("fs") as object),
  readFileSync: jest.fn().mockReturnValue("mocked-file-content"),
}));

jest.mock("../module", () => ({
  isBuildMode: jest.fn(() => false),
  isWatchMode: jest.fn(() => false),
  isDevMode: jest.fn(() => true),
}));

jest.mock("../logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock("../metrics", () => ({
  metricsCollector: {
    timeout: jest.fn(),
    alert: jest.fn(),
    getMetrics: jest.fn().mockResolvedValue("mocked-metrics" as never),
    observeStart: jest.fn(() => Date.now()),
    observeEnd: jest.fn(),
    error: jest.fn(),
  },
}));

describe("Controller", () => {
  let app: express.Application;
  let controller: Controller;

  beforeEach(() => {
    const config: ModuleConfig = { uuid: "test-uuid" } as ModuleConfig;
    const capabilities: Capability[] = [];
    controller = new Controller(config, capabilities);
    controller["bindEndpoints"]();
    app = controller.app;
  });

  it("should respond to health check", async () => {
    const response = await request(app).get("/healthz");
    expect(response.status).toBe(200);
    expect(response.text).toBe("OK");
  });

  it("should respond with metrics", async () => {
    const response = await request(app).get("/metrics");
    expect(response.status).toBe(200);
    expect(response.text).toBe("mocked-metrics");
  });

  it("should validate token", async () => {
    controller.token = "valid-token";
    const response = await request(app).post("/mutate/invalid-token");
    expect(response.status).toBe(401);
    expect(response.text).toContain("Unauthorized");
  });

  it("should respond with 500 if an error occurs", async () => {
    app.get("/error", () => {
      throw new Error("test-error");
    });

    const response = await request(app).get("/error");
    expect(response.status).toBe(500);
    expect(response.text).toContain("test-error");
  });

  it("should log a timeout warning and increment the timeout metric when a timeout occurs", () => {
    const port = 3000;
    expect(() => controller.startServer(port)).not.toThrow();

    // Assert that the warning log and timeout metric were called
    expect(Log.warn).toHaveBeenCalledWith("Admission webhook request timed out.");
    expect(metricsCollector.timeout).toHaveBeenCalled();
  });

  it("should prevent starting the server when it is already running", () => {
    const port = 3000;
    controller.startServer(port); // Start the server initially
    expect(() => controller.startServer(port)).toThrow(
      "Cannot start Pepr module: Pepr module was not instantiated with deferStart=true",
    );
  });

  /* it('should gracefully handle SIGTERM and close the server', () => {
    const port = 3000;
    const mockClose = jest.fn((callback: () => void) => callback());

    // Mock the server close function
    (https.createServer().listen as jest.Mock).mockReturnValueOnce({
      on: jest.fn(),
      close: mockClose,
    });

    controller.startServer(port);

    // Simulate SIGTERM
    process.emit('SIGTERM');

    // Assert the server close and log behavior
    expect(Log.info).toHaveBeenCalledWith("Received SIGTERM, closing server");
    expect(mockClose).toHaveBeenCalled();
    expect(Log.info).toHaveBeenCalledWith("Server closed");
  }); */

  /* it("should retry when the port is in use (EADDRINUSE)", () => {
    const port = 3000;
    const mockClose = jest.fn();
    const mockListen = jest.fn().mockImplementation((p, callback) => {
      const error = { code: "EADDRINUSE" };
      https.createServer().listen().emit("error", error); // Simulate the error
      setTimeout(callback as () => void, 2000); // Simulate retry
    });

    (https.createServer().listen as jest.Mock).mockReturnValueOnce({
      on: jest.fn(),
      close: mockClose,
      listen: mockListen,
    });

    controller.startServer(port);

    // Add this line to debug all Log.info calls
    console.log((Log.info as jest.Mock).mock.calls);

    expect(Log.info).toHaveBeenCalledWith(expect.stringContaining("Address in use, retrying in 2 seconds"));
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 2000);
    expect(mockClose).toHaveBeenCalled();
  });
 */

  it("should allow valid token and proceed to the next middleware", async () => {
    controller.token = "valid-token";

    const app = express();
    app.use("/mutate/:token", controller["validateToken"], ((req: express.Request, res: express.Response): void => {
      res.send("OK");
    }) as express.RequestHandler);

    const response = await request(app).post("/mutate/valid-token");

    expect(response.status).toBe(200);
    expect(response.text).toBe("OK");
  });

  it("should reject invalid token and increment alert metrics", async () => {
    controller.token = "valid-token";

    const app = express();
    app.use("/mutate/:token", controller["validateToken"]);

    const response = await request(app).post("/mutate/invalid-token");

    expect(response.status).toBe(401);
    expect(response.text).toContain("Unauthorized: invalid token");
    expect(metricsCollector.alert).toHaveBeenCalled();
  });

  /*   it("should return 500 when an error occurs during admission processing", async () => {
    const admissionKind = "Mutate";
    const mockError = new Error("Test admission error");

    // Set a valid token to bypass the token validation
    controller.token = "valid-token";

    // Mock mutateProcessor to throw an error
    (mutateProcessor as jest.Mock).mockRejectedValue(mockError as never);

    const response = await request(app).post("/mutate/valid-token").send({ request: {} });

    expect(response.status).toBe(500);
    expect(response.text).toContain("Internal Server Error");
    expect(Log.error).toHaveBeenCalledWith(mockError, `Error processing ${admissionKind} request`);
  }, 10000);  // Increased timeout to 10 seconds */

  it("should return 500 if an error occurs in the metrics endpoint", async () => {
    (metricsCollector.getMetrics as jest.Mock).mockRejectedValueOnce(new Error("Metrics error") as never);

    const response = await request(app).get("/metrics");

    expect(response.status).toBe(500);
    expect(response.text).toBe("Internal Server Error");
    expect(Log.error).toHaveBeenCalledWith(expect.any(Error), "Error getting metrics");
  });
});
