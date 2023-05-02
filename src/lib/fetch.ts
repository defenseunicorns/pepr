// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { StatusCodes } from "http-status-codes";
import type { RequestInfo, RequestInit } from "node-fetch";
import logger from "./logger";

export { fetchRaw as f };

/**
 * Perform an async HTTP call and return the parsed JSON response, optionally
 * as a specific type.
 *
 * @example
 *