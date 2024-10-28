// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { AssetsConfig } from "./assetsConfig";
import { AssetsDeployer } from "./assetsDeployer";
import { ModuleConfig } from "../module";

export function createAssets(config: ModuleConfig, path: string, host?: string) {
  const assetsConfig = new AssetsConfig(config, path, host);
  return new AssetsDeployer(assetsConfig);
}
