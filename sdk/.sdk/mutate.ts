// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { V1ObjectMeta, V1Pod, V1Service } from "@models";

let svc: V1Service;

let meta: V1ObjectMeta = {
  name: "test",
};

let pod: V1Pod = {
  metadata: meta,
};

mutate("test", pod);

export function mutate(name: string, options: any) {}
