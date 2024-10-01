import { KubernetesObject } from "@kubernetes/client-node";
import { GenericClass } from "../types";
import { Filters, K8sInit } from "./types";
/**
 * Kubernetes fluent API inspired by Kubectl. Pass in a model, then call filters and actions on it.
 *
 * @param model - the model to use for the API
 * @param filters - (optional) filter overrides, can also be chained
 * @returns a fluent API for the model
 */
export declare function K8s<T extends GenericClass, K extends KubernetesObject = InstanceType<T>>(model: T, filters?: Filters): K8sInit<T, K>;
//# sourceMappingURL=index.d.ts.map