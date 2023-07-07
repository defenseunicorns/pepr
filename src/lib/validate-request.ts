// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { KubernetesObject } from "./k8s/types";
import { PeprObserveRequest } from "./observe-request";

/**
 * The RequestWrapper class provides methods to modify Kubernetes objects in the context
 * of a mutating webhook request.
 */
export class PeprValidateRequest<T extends KubernetesObject> extends PeprObserveRequest<T> {}
