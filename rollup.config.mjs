// rollup.config.js
import json from '@rollup/plugin-json';
import typescript from '@rollup/plugin-typescript';
import { visualizer } from 'rollup-plugin-visualizer';

export default {
    input: {
        cli: 'src/cli/index.ts',
        controller: 'src/controller/index.ts',
    },
    output: {
        dir: 'dist',
        format: 'cjs',
        sourcemap: true,
        entryFileNames: 'pepr-[name].js',
        banner: '#!/usr/bin/env node',
    },
    plugins: [
        json(),
        typescript({
            tsconfig: "./tsconfig.json",
            sourceMap: true,
        }),
        visualizer(),
    ],
    treeshake: true,
};
