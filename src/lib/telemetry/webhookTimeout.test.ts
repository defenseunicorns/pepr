// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import { MeasureWebhookTimeout } from "./webhookTimeouts";
import { metricsCollector } from "./metrics";
import { getNow } from "./timeUtils";
import { WebhookType } from "../enums";
import Log from "./logger";

vi.mock("./metrics", () => ({
  metricsCollector: {
    addCounter: vi.fn(),
    incCounter: vi.fn(),
  },
}));

vi.mock("./timeUtils", () => ({
  getNow: vi.fn(),
}));

vi.mock("./logger", () => ({
  default: {
    debug: vi.fn(),
  },
}));

describe("MeasureWebhookTimeout", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("when initialized", () => {
    it("should create a timeout counter for the webhook type", () => {
      const webhookType = WebhookType.MUTATE;
      new MeasureWebhookTimeout(webhookType);
      expect(metricsCollector.addCounter).toHaveBeenCalledWith(
        `${WebhookType.MUTATE}_timeouts`,
        "Number of mutate webhook timeouts",
      );
    });
  });

  describe("when stopping the timer", () => {
    describe("and the timer was not started", () => {
      it("should throw an error", () => {
        const webhook = new MeasureWebhookTimeout(WebhookType.MUTATE);
        expect(() => webhook.stop()).toThrow("Timer was not started before calling stop.");
      });
    });

    describe("and the timer was started", () => {
      it("should log start/stop messages", () => {
        // 50ms elapsed with default 10s timeout
        (getNow as Mock).mockReturnValueOnce(5000).mockReturnValueOnce(5050);
        const webhook = new MeasureWebhookTimeout(WebhookType.MUTATE);
        webhook.start();
        webhook.stop();
        expect(Log.debug).toHaveBeenCalledWith("Starting timer at 5000");
        expect(Log.debug).toHaveBeenCalledWith("Webhook 5000 took 50ms");
      });

      // All tests below use realistic units: timeout parameter is in
      // seconds (Kubernetes timeoutSeconds, 1-30) and getNow() returns
      // milliseconds (performance.now()).

      describe("and elapsed time is less than timeout", () => {
        it("should not increment the timeout counter", () => {
          // 50ms elapsed, 10s timeout → no timeout
          (getNow as Mock).mockReturnValueOnce(0).mockReturnValueOnce(50);
          const webhook = new MeasureWebhookTimeout(WebhookType.MUTATE);
          webhook.start(10);
          webhook.stop();
          expect(metricsCollector.incCounter).not.toHaveBeenCalled();
        });
      });

      describe("and elapsed time exceeds timeout", () => {
        it("should increment the timeout counter", () => {
          // 12s elapsed, 10s timeout → timeout
          (getNow as Mock).mockReturnValueOnce(0).mockReturnValueOnce(12_000);
          const webhook = new MeasureWebhookTimeout(WebhookType.MUTATE);
          webhook.start(10);
          webhook.stop();
          expect(metricsCollector.incCounter).toHaveBeenCalledWith(
            `${WebhookType.MUTATE}_timeouts`,
          );
        });
      });

      describe("and elapsed time exactly equals timeout", () => {
        it("should not increment the timeout counter", () => {
          // 10s elapsed, 10s timeout → not a timeout (only strictly greater triggers)
          (getNow as Mock).mockReturnValueOnce(0).mockReturnValueOnce(10_000);
          const webhook = new MeasureWebhookTimeout(WebhookType.MUTATE);
          webhook.start(10);
          webhook.stop();
          expect(metricsCollector.incCounter).not.toHaveBeenCalled();
        });
      });
    });
  });
});
