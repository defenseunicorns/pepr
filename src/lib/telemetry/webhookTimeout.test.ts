// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { MeasureWebhookTimeout } from "./webhookTimeouts";
import { metricsCollector } from "./metrics";

jest.mock("./metrics", () => ({
  metricsCollector: {
    addCounter: jest.fn(),
    incCounter: jest.fn(),
  },
}));

describe("MeasureWebhookTimeout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should initialize a timeout counter for the webhook type", () => {
    const webhookType = "testWebhook";
    new MeasureWebhookTimeout(webhookType);

    expect(metricsCollector.addCounter).toHaveBeenCalledWith(
      "testWebhook_timeouts",
      "Number of testWebhook webhook timeouts",
    );
  });

  it("should throw an error if stop is called before start", () => {
    const webhook = new MeasureWebhookTimeout("testWebhook");

    expect(() => webhook.stop()).toThrow("Timer was not started before calling stop.");
  });

  it("should not increment the timeout counter if elapsed time is less than the timeout", () => {
    const webhook = new MeasureWebhookTimeout("testWebhook");
    webhook.start(1000);
    jest.spyOn(performance, "now").mockImplementationOnce(() => performance.now() + 500);

    webhook.stop();

    expect(metricsCollector.incCounter).not.toHaveBeenCalled();
  });

  it("should increment the timeout counter if elapsed time exceeds the timeout", () => {
    const webhook = new MeasureWebhookTimeout("testWebhook");
    webhook.start(500);
    jest.spyOn(performance, "now").mockImplementationOnce(() => performance.now() + 1000);

    webhook.stop();

    expect(metricsCollector.incCounter).toHaveBeenCalledWith("testWebhook_timeouts");
  });
});
