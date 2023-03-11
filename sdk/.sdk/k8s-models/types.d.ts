// Source: https://github.com/kubernetes-client/javascript/blob/0.18.0/src/types.ts
import { V1ListMeta, V1ObjectMeta } from "./gen/model/models";
export interface KubernetesObject {
  apiVersion?: string;
  kind?: string;
  metadata?: V1ObjectMeta;
}
export interface KubernetesListObject<T extends KubernetesObject> {
  apiVersion?: string;
  kind?: string;
  metadata?: V1ListMeta;
  items: T[];
}
export type IntOrString = number | string;
export declare class V1MicroTime extends Date {
  toISOString(): string;
}
