// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { MeasureWebhookTimeout } from "./webhookTimeouts";
import { metricsCollector } from "./metrics";
import { getNow } from "./timeUtils";

jest.mock("./metrics", () => ({
  metricsCollector: {
    addCounter: jest.fn(),
    incCounter: jest.fn(),
  },
}));

jest.mock("./timeUtils", () => ({
  getNow: jest.fn(),
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
    (getNow as jest.Mock).mockReturnValueOnce(1000).mockReturnValueOnce(1500);

    const webhook = new MeasureWebhookTimeout("testWebhook");
    webhook.start(1000);

    webhook.stop();

    expect(metricsCollector.incCounter).not.toHaveBeenCalled();
  });

  it("should increment the timeout counter if elapsed time exceeds the timeout", () => {
    (getNow as jest.Mock).mockReturnValueOnce(1000).mockReturnValueOnce(2000);

    const webhook = new MeasureWebhookTimeout("testWebhook");
    webhook.start(500);

    webhook.stop();

    expect(metricsCollector.incCounter).toHaveBeenCalledWith("testWebhook_timeouts");
  });
});
