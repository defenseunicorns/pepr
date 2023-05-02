"use strict";

import k8s from "@kubernetes/client-node";
import { StatusCodes as fetchStatus } from "http-status-codes";
import * as R from "ramda";
import { Capability } from "./src/lib/capability";
import { fetch, fetchRaw } from "./src/lib/fetch";
import { RegisterKind, a } from "./src/lib/k8s";
import Log from "./src/lib/logger";
import { PeprModule } from "./src/lib/module";
import { PeprRequest } from "./src/lib/request";

// Import type information for external packages
import type * as KubernetesClientNode from "@kubernetes/client-node";
import type * as RamdaUtils from "ramda";

export {
  a,
  /** PeprModule is used to setup a complete Pepr Module: `new PeprModule(cfg, {...capabilities})` */
  PeprModule,
  PeprRequest,
  RegisterKind,
  Capability,
  Log,
  R,
  fetch,
  fetchRaw,
  fetchStatus,
  k8s,

  // Export the imported type information for external packages
  RamdaUtils,
  KubernetesClientNode,
};

/**
 * Fetches data from a URL and returns the response body as a string.
 * @param {string} url - The URL to fetch.
 * @param {object} [options] - Optional fetch options.
 * @returns {Promise<string>} - A promise that resolves to the response body as a string.
 */
export const fetchData = async (url, options = {}) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Failed to fetch data from ${url}: ${response.statusText}`);
  }
  return await response.text();
};

/**
 * Fetches data from a URL and returns the response body as a JSON object.
 * @param {string} url - The URL to fetch.
 * @param {object} [options] - Optional fetch options.
 * @returns {Promise<object>} - A promise that resolves to the response body as a JSON object.
 */
export const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Failed to fetch JSON from ${url}: ${response.statusText}`);
  }
  return await response.json();
};

/**
 * Fetches data from a URL and returns the response body as a buffer.
 * @param {string} url - The URL to fetch.
 * @param {object} [options] - Optional fetch options.
 * @returns {Promise<Buffer>} - A promise that resolves to the response body as a buffer.
 */
export const fetchBuffer = async (url, options = {}) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Failed to fetch buffer from ${url}: ${response.statusText}`);
  }
  return await response.buffer();
};

/**
 * Fetches data from a URL and returns the response body as a stream.
 * @param {string} url - The URL to fetch.
 * @param {object} [options] - Optional fetch options.
 * @returns {Promise<ReadableStream>} - A promise that resolves to the response body as a stream.
 */
export const fetchStream = async (url, options = {}) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Failed to fetch stream from ${url}: ${response.statusText}`);
  }
  return response.body;
};