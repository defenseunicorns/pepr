// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import crypto from "crypto";

import { TLSOut, genTLS } from "../k8s/tls";
import { CapabilityExport, ModuleConfig } from "../types";
import { deploy } from "./deploy";
import { loadCapabilities } from "./loader";
import { allYaml, zarfYaml } from "./yaml";

export class Assets {
  readonly name: string;
  readonly tls: TLSOut;
  readonly apiToken: string;
  capabilities!: CapabilityExport[];
  image: string;

  constructor(
    readonly config: ModuleConfig,
    readonly path: string,
    readonly host?: string,
  ) {
    // Bind public methods
    this.deploy = this.deploy.bind(this);
    this.zarfYaml = this.zarfYaml.bind(this);
    this.allYaml = this.allYaml.bind(this);

    this.name = `pepr-${config.uuid}`;

    this.image = `ghcr.io/defenseunicorns/pepr/controller:v${config.peprVersion}`;

    // Generate the ephemeral tls things
    this.tls = genTLS(this.host || `${this.name}.pepr-system.svc`);

    // Generate the api token for the controller / webhook
    this.apiToken = crypto.randomBytes(32).toString("hex");
  }

  public async deploy(webhookTimeout?: number) {
    this.capabilities = await loadCapabilities(this.path);
    await deploy(this, webhookTimeout);
  }

  public zarfYaml(path: string) {
    return zarfYaml(this, path);
  }

  public async allYaml() {
    this.capabilities = await loadCapabilities(this.path);
    return allYaml(this);
  }
}
