// Source: https://github.com/kubernetes-client/javascript/blob/0.18.0/src/types.ts
import { ListMeta, ObjectMeta } from "./gen/model/models";
export interface KubernetesObject {
  apiVersion?: string;
  kind?: string;
  metadata?: ObjectMeta;
}
export interface KubernetesListObject<T extends KubernetesObject> {
  apiVersion?: string;
  kind?: string;
  metadata?: ListMeta;
  items: T[];
}
export type IntOrString = number | string;
