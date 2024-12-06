// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Operation } from "fast-json-patch";
import { pino, stdTimeFunctions } from "pino";
import { Store } from "../k8s";

const isPrettyLog = process.env.PEPR_PRETTY_LOGS === "true";
const redactedValue = "**redacted**";

const pretty = {
  target: "pino-pretty",
  options: {
    colorize: true,
  },
};

const transport = isPrettyLog ? pretty : undefined;
// epochTime is the pino default
const pinoTimeFunction =
  process.env.PINO_TIME_STAMP === "iso" ? () => stdTimeFunctions.isoTime() : () => stdTimeFunctions.epochTime();
const Log = pino({
  transport,
  timestamp: pinoTimeFunction,
});

if (process.env.LOG_LEVEL) {
  Log.level = process.env.LOG_LEVEL;
}

export function redactedStore(store: Store): Store {
  const redacted = process.env.PEPR_STORE_REDACT_VALUES === "true";
  return {
    ...store,
    data: Object.keys(store.data).reduce((acc: Record<string, string>, key: string) => {
      acc[key] = redacted ? redactedValue : store.data[key];
      return acc;
    }, {}),
  };
}

export function redactedPatch(patch: Record<string, Operation> = {}): Record<string, Operation> {
  const redacted = process.env.PEPR_STORE_REDACT_VALUES === "true";

  if (!redacted) {
    return patch;
  }

  const redactedCache: Record<string, Operation> = {};

  Object.entries(patch).forEach(([key, operation]) => {
    const isRedacted = key.includes(":");
    const targetKey = isRedacted ? `${key.substring(0, key.lastIndexOf(":"))}:**redacted**` : key;

    const redactedOperation = isRedacted
      ? {
          ...operation,
          ...(Object.hasOwn(operation, "value") ? { value: redactedValue } : {}),
        }
      : operation;

    redactedCache[targetKey] = redactedOperation;
  });

  return redactedCache;
}

export default Log;
