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
        (getNow as Mock).mockReturnValueOnce(1).mockReturnValueOnce(2);
        const webhook = new MeasureWebhookTimeout(WebhookType.MUTATE);
        webhook.start();
        webhook.stop();
        expect(Log.debug).toHaveBeenCalledWith("Starting timer at 1");
        expect(Log.debug).toHaveBeenCalledWith("Webhook 1 took 1ms");
      });
      describe("and elapsed time is less than timeout", () => {
        it("should not increment the timeout counter", () => {
          (getNow as Mock).mockReturnValueOnce(1000).mockReturnValueOnce(1500);
          const webhook = new MeasureWebhookTimeout(WebhookType.MUTATE);
          webhook.start(1000);
          webhook.stop();
          expect(metricsCollector.incCounter).not.toHaveBeenCalled();
        });
      });

      describe("and elapsed time exceeds timeout", () => {
        it("should increment the timeout counter", () => {
          (getNow as Mock).mockReturnValueOnce(1000).mockReturnValueOnce(2000);
          const webhook = new MeasureWebhookTimeout(WebhookType.MUTATE);
          webhook.start(500);
          webhook.stop();
          expect(metricsCollector.incCounter).toHaveBeenCalledWith(
            `${WebhookType.MUTATE}_timeouts`,
          );
        });
      });
    });
  });
});
