// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { Request } from "./k8s";
import { Binding } from "./types";

// janky placeholder to start some filtering
export function filterBinding({ kind, filters }: Binding, req: Request) {
  // @todo: finish these and actually write them properly
  if (kind.kind !== req.kind) {
    return false;
  }

  if (
    filters.namespaces.length &&
    !filters.namespaces.includes(req.namespace || "")
  ) {
    return false;
  }

  return true;
}
