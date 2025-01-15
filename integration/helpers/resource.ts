import { readFile } from "node:fs/promises";
import { kind, KubernetesObject } from "kubernetes-fluent-client";
import { parseAllDocuments } from "yaml";

/**
 * Read resources from a file and return them as JS objects.
 *
 * @param path Path to the file (supports JSON (*.json) or YAML (*.yaml))
 * @param single If true, return a single object; otherwise, return an array of objects.
 * @returns JS object or array of JS objects.
 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export async function resourcesFromFile(path: string): Promise<any | any[]> {
  const extension = path.split(".").at(-1);

  let result: object | object[];
  const content = await readFile(path, { encoding: "utf8" });

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
