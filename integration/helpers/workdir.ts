import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { existsSync } from "node:fs";
import * as time from "./time";

export class Workdir {
  root: string;
  leaf: string;

  constructor(leaf: string, root: string = os.tmpdir()) {
    this.leaf = leaf;
    this.root = path.resolve(root);
  }

  path(): string {
    return path.join(this.root, this.leaf);
  }

  async create(): Promise<string> {
    await fs.mkdir(this.path(), { recursive: true });
    return this.path();
  }

  async exists(): Promise<boolean> {
    return existsSync(this.path());
  }

  async isEmpty(): Promise<boolean> {
    const contents = await fs.readdir(this.path());
    return contents.length > 0 ? false : true;
  }

  async delete(): Promise<void> {
    await fs.rm(this.path(), { recursive: true, force: true });
  }

  async recreate(): Promise<string> {
    await this.delete();
    await time.nap(100);
    return await this.create();
  }
}
