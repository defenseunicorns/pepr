// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { CoreV1Api, HttpError, KubeConfig, PatchUtils, V1Secret } from "@kubernetes/client-node";
import { StatusCodes } from "http-status-codes";
import { map, startsWith } from "ramda";

import { Operation } from "fast-json-patch";
import { Capability } from "../capability";
import { a } from "../k8s";
import Log from "../logger";
import { DataOp, DataSender, DataStore, Storage } from "../storage";
import { ModuleConfig } from "../types";
import { base64Decode, base64Encode } from "../utils";
import { SimpleWatch, WatchOptions } from "../watch";

const namespace = "pepr-system";

export class PeprControllerStore {
  private _name: string;
  private _coreV1API: CoreV1Api;
  private _stores: Record<string, Storage> = {};

  constructor(
    config: ModuleConfig,
    capabilities: Capability[],
    private _onReady?: () => void,
  ) {
    // Setup Pepr State bindings
    this._name = `pepr-${config.uuid}-store`;

    // Deploy the resources using the k8s API
    const kubeConfig = new KubeConfig();
    kubeConfig.loadFromDefault();

    this._coreV1API = kubeConfig.makeApiClient(CoreV1Api);

    // Ensure the secret exists
    this._coreV1API.readNamespacedSecret(this._name, namespace).catch(this.handleMissingSecret);

    // Establish the store for each capability
    for (const { name, _registerStore } of capabilities) {
      // Register the store with the capability
      const { store } = _registerStore();

      // Bind the store sender to the capability
      store.registerSender(this.sendData(name));

      // Store the storage instance
      this._stores[name] = store;
    }

    // Setup the watch
    this.setupWatch();
  }

  private setupWatch = () => {
    const watchOpts: WatchOptions = {
      namespace,
      name: this._name,
    };

    SimpleWatch(a.Secret, watchOpts).Start(this.handleSecret);
  };

  private handleSecret = (secret: V1Secret) => {
    Log.debug(secret, "Pepr Store update");

    // Base64 decode the data
    const data: DataStore = map(base64Decode, secret.data || {});

    // Loop over each stored capability
    for (const name of Object.keys(this._stores)) {
      // Get the prefix offset for the keys
      const offset = `${name}-`.length;

      // Get any keys that match the capability name prefix
      const filtered: DataStore = {};

      // Loop over each key in the secret
      for (const key of Object.keys(data)) {
        // Match on the capability name as a prefix
        if (startsWith(name, key)) {
          // Strip the prefix and store the value
          filtered[key.slice(offset)] = data[key];
        }
      }

      // Send the data to the receiver callback
      this._stores[name].receive(filtered);
    }

    // Call the onReady callback if this is the first time the secret has been read
    if (this._onReady) {
      this._onReady();
      this._onReady = undefined;
    }
  };

  private sendData = (capabilityName: string) => {
    const sender: DataSender = async (op: DataOp, key: string[], value?: string) => {
      try {
        const options = { headers: { "Content-type": PatchUtils.PATCH_FORMAT_JSON_PATCH } };
        const patches: Operation[] = [];

        switch (op) {
          case "add":
            patches.push({
              op,
              path: `/data/${capabilityName}-${key}`,
              value: base64Encode(value || ""),
            });
            break;

          case "remove":
            if (key.length < 1) {
              throw new Error(`Key is required for REMOVE operation`);
            }

            for (const k of key) {
              patches.push({
                op,
                path: `/data/${capabilityName}-${k}`,
              });
            }
            break;
        }

        const result = await this._coreV1API.patchNamespacedSecret(
          this._name,
          namespace,
          patches,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          options,
        );

        this.handleSecret(result.body);
      } catch (e) {
        console.error(e, `Pepr store update failure for ${capabilityName}`);
      }
    };

    return sender;
  };

  private handleMissingSecret = async (err: HttpError) => {
    // If the secret is not found, create it
    if (err.statusCode === StatusCodes.NOT_FOUND) {
      Log.info(`Pepr store secret not found, creating...`);

      const secret: V1Secret = {
        apiVersion: "v1",
        kind: "Secret",
        metadata: {
          name: this._name,
          namespace,
        },
        data: {
          // JSON Patch will die if the data is empty, so we need to add a placeholder
          __pepr_do_not_delete__: "cGxhY2Vob2xkZXI=",
        },
      };

      await this._coreV1API.createNamespacedSecret(namespace, secret);
    } else {
      Log.error(err, "Pepr store init failure");
    }
  };
}
