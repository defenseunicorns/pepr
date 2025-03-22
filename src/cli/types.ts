import { Answers } from "prompts";

export type InitOptions = Answers<"name" | "description" | "errorBehavior" | "uuid">;
