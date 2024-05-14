// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { pino } from "pino";

const isPrettyLog = process.env.PEPR_PRETTY_LOGS === "true";

const pretty = {
  target: "pino-pretty",
  options: {
    colorize: true,
  },
};

const transport = isPrettyLog ? pretty : undefined;
const pinoTimeStamp = process.env.PINO_TIME_STAMP === "iso" ? `,"time":"${new Date(Date.now()).toISOString()}"` : `,"time":"${Date.now()}"`;
const Log = pino({
  transport,
  timestamp: () => pinoTimeStamp
});

if (process.env.LOG_LEVEL) {
  Log.level = process.env.LOG_LEVEL;
}
export default Log;
