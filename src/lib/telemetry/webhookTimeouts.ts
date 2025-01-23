import { performance } from "perf_hooks";
import { metricsCollector } from "./metrics";

export class MeasureWebhookTimeout {
  #startTime: number | null = null;
  #webhookType: string;
  timeout: number = 0;

  constructor(webhookType: string) {
    this.#webhookType = webhookType;
    metricsCollector.addCounter(`${webhookType}_timeouts`, `Number of ${webhookType} webhook timeouts`);
  }

  start(timeout: number = 10): void {
    this.#startTime = performance.now();
    this.timeout = timeout;
  }

  stop(): void {
    if (this.#startTime === null) {
      throw new Error("Timer was not started before calling stop.");
    }

    const elapsedTime = performance.now() - this.#startTime;
    this.#startTime = null;

    if (elapsedTime > this.timeout) {
      metricsCollector.incCounter(`${this.#webhookType}_timeouts`);
    }
  }
}
