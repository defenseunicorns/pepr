// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import selfsigned from "selfsigned";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface TlsCertPaths {
  keyPath: string;
  certPath: string;
}

/**
 * Creates temporary TLS certificate files for testing.
 * Uses the selfsigned package to generate a self-signed certificate.
 */
export async function createTestCertFiles(directory: string): Promise<TlsCertPaths> {
  const pems = await selfsigned.generate([{ name: "commonName", value: "localhost" }], {
    days: 1,
  });

  const keyPath = path.join(directory, "tls.key");
  const certPath = path.join(directory, "tls.crt");

  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(keyPath, pems.private);
  await fs.writeFile(certPath, pems.cert);

  return { keyPath, certPath };
}

/**
 * Sets up the environment for testing module loading.
 * Creates TLS certificates and sets environment variables needed
 * to successfully import a built Pepr module.
 */
export async function setupTlsEnv(directory: string): Promise<TlsCertPaths> {
  const paths = await createTestCertFiles(directory);

  process.env.SSL_KEY_PATH = paths.keyPath;
  process.env.SSL_CERT_PATH = paths.certPath;
  // PEPR_API_PATH prevents reading /app/api-path/value which doesn't exist in test env
  process.env.PEPR_API_PATH = "test-api-path";

  return paths;
}

/**
 * Cleans up environment variables after testing.
 */
export function cleanupTlsEnv(): void {
  delete process.env.SSL_KEY_PATH;
  delete process.env.SSL_CERT_PATH;
  delete process.env.PEPR_API_PATH;
}
