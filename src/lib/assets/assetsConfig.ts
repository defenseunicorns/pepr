// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import crypto from "crypto";
import { TLSOut, genTLS } from "../tls";
import { ModuleConfig } from "../module";
import { CapabilityExport } from "../types";
import { WebhookIgnore } from "../k8s";

export class AssetsConfig {
  readonly name: string;
  readonly tls: TLSOut;
  readonly apiToken: string;
  readonly alwaysIgnore!: WebhookIgnore;
  capabilities!: CapabilityExport[];

  image: string;
  buildTimestamp: string;
  hash: string;

  constructor(
    readonly config: ModuleConfig,
    readonly path: string,
    readonly host?: string,
  ) {
    this.name = `pepr-${config.uuid}`;
    this.buildTimestamp = `${Date.now()}`;
    this.alwaysIgnore = config.alwaysIgnore;
    this.image = `ghcr.io/defenseunicorns/pepr/controller:v${config.peprVersion}`;
    this.hash = "";
    this.tls = genTLS(this.host || `${this.name}.pepr-system.svc`);
    this.apiToken = crypto.randomBytes(32).toString("hex");
  }

  setHash = (hash: string) => {
    this.hash = hash;
  };
}
