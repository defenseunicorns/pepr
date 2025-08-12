import { createDir } from "./utils";
import { resolve } from "path";

export async function setupProjectStructure(dirName: string): Promise<void> {
  await createDir(dirName);
  await createDir(resolve(dirName, ".vscode"));
  await createDir(resolve(dirName, "capabilities"));
}
