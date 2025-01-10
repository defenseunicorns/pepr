import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import * as time from "./time";

export class Workdir {
  root: string;
  leaf: string;

  constructor(leaf: string, root: string = os.tmpdir()) {
    this.leaf = leaf;
    this.root = path.resolve(root);
  }

  path() {
    return path.join(this.root, this.leaf);
  }

  async create(): Promise<string> {
    await fs.mkdir(this.path(), { recursive: true });
    return this.path();
  }

  async exists() {
    try {
      await fs.access(this.path());
      return true;
    } catch (e) {
      if (e.message.includes("no such file or directory")) {
        return false;
      }
      throw e;
    }
  }

  async isEmpty() {
    const contents = await fs.readdir(this.path());
    return contents.length > 0 ? false : true;
  }

  async delete(): Promise<void> {
    await fs.rm(this.path(), { recursive: true, force: true });
  }

  async recreate(): Promise<string> {
    await this.delete();
    await time.nap(1);
    return await this.create();
  }
}
