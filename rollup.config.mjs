import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { readFileSync } from "fs";
import { visualizer } from "rollup-plugin-visualizer";

const pkg = JSON.parse(readFileSync("./package.json"));
const external = Object.keys(pkg.dependencies || {});
const plugins = [commonjs(), json(), typescript(), nodeResolve(), visualizer()];
const banner = "#!/usr/bin/env node";

export default [
    {
        input: "src/cli/index.ts",
        output: {
            banner,
            file: "dist/cli.js",
            format: "cjs",
        },
        external: ["fsevents", ...external],
        plugins,
    },
    {
        input: "src/cli/run.ts",
        output: {
            banner,
            file: "dist/run.js",
            format: "cjs",
        },
        external,
        plugins,
    },
];
