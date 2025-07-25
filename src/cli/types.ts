import { BuildResult, BuildOptions } from "esbuild";
import { Answers } from "prompts";

export type InitOptions = Answers<"name" | "description" | "errorBehavior" | "uuid">;

export type Reloader = (opts: BuildResult<BuildOptions>) => void | Promise<void>;
