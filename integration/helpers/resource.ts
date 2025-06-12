import { kind, KubernetesObject } from "kubernetes-fluent-client";
import { parseAllDocuments } from "yaml";
import { readFileSync } from "node:fs";
import fs from "fs";

/**
 * Read resources from a file and return them as JS objects.
 *
 * @param path Path to the file (supports JSON (*.json) or YAML (*.yaml))
 * @returns JS object or array of JS objects.
 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function fromFile(path: string): any | any[] {
  const extension = path.split(".").at(-1);

  let result: object | object[];
  const content = readFileSync(path, { encoding: "utf8" });

  switch (extension) {
    case "json": {
      const parsed = JSON.parse(content);
      result = Array.isArray(parsed) ? parsed : [parsed];
      break;
    }
    case "yaml": {
      const documents = parseAllDocuments(content).map(doc => doc.contents!.toJSON());
      result = documents.length === 1 ? documents[0] : documents;
      break;
    }
    default:
      throw new Error(`Unsupported file type ".${extension}"`);
  }

  // If the result is an array with one element, return the single element
  return Array.isArray(result) && result.length === 1 ? result[0] : result;
}

/**
 * Select & strongly-type resource from array of JS objects
 *
 * @param list Array of JS objects
 * @param asKind Type of object to select (from kubernetes-fluent-client, e.g. kind.Secret)
 * @param name Object.metadata.name to select
 * @returns Strong-typed resource object
 */
export function select<T extends KubernetesObject, U extends new () => InstanceType<U>>(
  list: T[],
  asKind: U,
  name: string,
): InstanceType<U> {
  const kynd = Object.entries(kind)
    .filter(f => f[1] === asKind)
    .at(0)!
    .at(0);
  return list
    .filter(f => f.kind === kynd)
    .filter(f => f!.metadata!.name === name)
    .at(0) as InstanceType<U>;
}

/**
 * Generic Kubernetes object interface (minimum fields needed to match kind + name)
 */
interface K8sObjectMeta {
  kind?: string;
  metadata?: {
    name?: string;
  };
}

/**
 * Reads a multi-document YAML file and extracts a K8s object by kind and name
 * @param filePath Path to the YAML file
 * @param kind Kubernetes resource kind (e.g., "ClusterRole", "ConfigMap")
 * @param name Resource name to match
 * @returns The object typed as T, or null if not found
 */
export function getK8sObjectByKindAndName<T>(
  filePath: string,
  kind: string,
  name: string,
): T | null {
  const fileContents = fs.readFileSync(filePath, "utf8");
  const cleanedContents = fileContents
    .split("\n")
    .filter(line => !line.trim().startsWith("#"))
    .join("\n");
  const documents = parseAllDocuments(cleanedContents);

  for (const doc of documents) {
    const data = doc.toJSON() as K8sObjectMeta;

    if (data && data.kind === kind && data.metadata?.name === name) {
      return data as T;
    }
  }

  return null;
}
