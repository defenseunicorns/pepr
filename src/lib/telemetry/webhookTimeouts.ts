import { metricsCollector } from "./metrics";
import { getNow } from "./timeUtils";
import Log from "./logger";
export class MeasureWebhookTimeout {
  #startTime: number | null = null;
  #webhookType: string;
  timeout: number = 0;

  constructor(webhookType: string) {
    this.#webhookType = webhookType;
    metricsCollector.addCounter(`${webhookType}_timeouts`, `Number of ${webhookType} webhook timeouts`);
  }

  start(timeout: number = 10): void {
    this.#startTime = getNow();
    this.timeout = timeout;
    Log.info(`Starting timer at ${this.#startTime}`);
  }

  stop(): void {
    if (this.#startTime === null) {
      throw new Error("Timer was not started before calling stop.");
    }

    const elapsedTime = getNow() - this.#startTime;
    Log.info(`Webhook ${this.#startTime} took ${elapsedTime}ms`);
    this.#startTime = null;

    if (elapsedTime > this.timeout) {
      metricsCollector.incCounter(`${this.#webhookType}_timeouts`);
    }
  }
}
