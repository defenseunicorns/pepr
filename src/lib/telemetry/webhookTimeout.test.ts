// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { MeasureWebhookTimeout } from "./webhookTimeouts";
import { metricsCollector } from "./metrics";
import { getNow } from "./timeUtils";
import { WebhookType } from "../enums";

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
    const webhookType = WebhookType.MUTATE;
    new MeasureWebhookTimeout(webhookType);

    expect(metricsCollector.addCounter).toHaveBeenCalledWith(
      `${WebhookType.MUTATE}_timeouts`,
      "Number of mutate webhook timeouts",
    );
  });

  it("should throw an error if stop is called before start", () => {
    const webhook = new MeasureWebhookTimeout(WebhookType.MUTATE);

    expect(() => webhook.stop()).toThrow("Timer was not started before calling stop.");
  });

  it("should not increment the timeout counter if elapsed time is less than the timeout", () => {
    (getNow as jest.Mock).mockReturnValueOnce(1000).mockReturnValueOnce(1500);

    const webhook = new MeasureWebhookTimeout(WebhookType.MUTATE);
    webhook.start(1000);

    webhook.stop();

    expect(metricsCollector.incCounter).not.toHaveBeenCalled();
  });

  it("should increment the timeout counter if elapsed time exceeds the timeout", () => {
    (getNow as jest.Mock).mockReturnValueOnce(1000).mockReturnValueOnce(2000);

    const webhook = new MeasureWebhookTimeout(WebhookType.MUTATE);
    webhook.start(500);

    webhook.stop();

    expect(metricsCollector.incCounter).toHaveBeenCalledWith(`${WebhookType.MUTATE}_timeouts`);
  });
});
