import { BuildResult, BuildOptions } from "esbuild";
import { Answers } from "prompts";
import { ModuleConfig } from "../lib/types";

export type InitOptions = Answers<"name" | "description" | "errorBehavior" | "uuid">;

export type Reloader = (opts: BuildResult<BuildOptions>) => void | Promise<void>;

export type PeprConfig = Omit<ModuleConfig, keyof PeprNestedFields> & {
  pepr: PeprNestedFields & {
    includedFiles: string[];
  };
  description: string;
  version: string;
};

type PeprNestedFields = Pick<
  ModuleConfig,
  | "uuid"
  | "onError"
  | "webhookTimeout"
  | "customLabels"
  | "alwaysIgnore"
  | "env"
  | "rbac"
  | "rbacMode"
> & {
  peprVersion: string;
};
