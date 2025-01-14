import { readFile } from "node:fs/promises";
import { kind, KubernetesObject } from "kubernetes-fluent-client";
import { parseDocument, parseAllDocuments } from "yaml";

/**
 * Read one resource from file, rehydrated as a JS object
 *
 * @param path Path to file holding one JSON (*.json) object / YAML (*.yaml) document
 * @returns JS object
 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export async function oneFromFile(path: string): Promise<any> {
  const ext = path.split(".").at(-1);

  let ret: object;
  switch (ext) {
    case "json": {
      const all = JSON.parse(await readFile(path, { encoding: "utf8" }));
      ret = Array.isArray(all) ? all.at(0) : all;
      break;
    }

    case "yaml":
      ret = parseDocument(await readFile(path, { encoding: "utf8" })).contents!.toJSON();
      break;

    default:
      throw `oops: don't recognize file of type ".${ext}"`;
  }

  return ret;
}

/**
 * Read many resources from file, rehydrated as an array of JS objects
 *
 * @param path Path to file holding an array of JSON (*.json) objects / multiple concatinated YAML (*.yaml) documents
 * @returns Array of JS objects
 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export async function manyFromFile(path: string): Promise<any[]> {
  const ext = path.split(".").at(-1);

  let ret: object[];
  switch (ext) {
    case "json": {
      const all = JSON.parse(await readFile(path, { encoding: "utf8" }));
      ret = Array.isArray(all) ? all : [all];
      break;
    }

    case "yaml":
      ret = parseAllDocuments(await readFile(path, { encoding: "utf8" })).map(yamlDoc =>
        yamlDoc.contents!.toJSON(),
      );
      break;

    default:
      throw `oops: don't recognize file of type ".${ext}"`;
  }

  return ret;
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
