// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { pino, stdTimeFunctions } from "pino";

const isPrettyLog = process.env.PEPR_PRETTY_LOGS === "true";

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
export default Log;
