import { KubernetesObject, V1ObjectMeta } from "@kubernetes/client-node";
export { KubernetesObject, KubernetesListObject } from "@kubernetes/client-node";
export type GenericClass = abstract new () => any;
/**
 * GenericKind is a generic Kubernetes object that can be used to represent any Kubernetes object
 * that is not explicitly supported. This can be used on its own or as a base class for
 * other types.
 */
export declare class GenericKind implements KubernetesObject {
    apiVersion?: string;
    kind?: string;
    metadata?: V1ObjectMeta;
    [key: string]: any;
}
/**
 * GroupVersionKind unambiguously identifies a kind. It doesn't anonymously include GroupVersion
 * to avoid automatic coercion. It doesn't use a GroupVersion to avoid custom marshalling
 */
export interface GroupVersionKind {
    /** The K8s resource kind, e..g "Pod". */
    readonly kind: string;
    readonly group: string;
    readonly version?: string;
    /** Optional, override the plural name for use in Webhook rules generation */
    readonly plural?: string;
}
export interface LogFn {
    <T extends object>(obj: T, msg?: string, ...args: never[]): void;
    (obj: unknown, msg?: string, ...args: never[]): void;
    (msg: string, ...args: never[]): void;
}
//# sourceMappingURL=types.d.ts.map