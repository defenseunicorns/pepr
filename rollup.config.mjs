// rollup.config.js
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import { visualizer } from 'rollup-plugin-visualizer';

export default {
    external: [
        /@kubernetes\/client-node(\/.*)?/,
        'commander',
        'express',
        'fast-json-patch',
        'ramda',
    ],
    input: {
        cli: 'src/cli/index.ts',
        controller: 'src/controller/index.ts',
        test: 'src/fixtures/index.ts',
    },
    output: {
        dir: 'dist',
        format: 'cjs',
        sourcemap: true,
        entryFileNames: 'pepr-[name].js'
    },
    plugins: [
        resolve({
            preferBuiltins: true,
        }),
        json(),
        typescript({
            tsconfig: "./tsconfig.json",
            declaration: false,
            sourceMap: true,
        }),
        visualizer(),
    ],
    treeshake: true,
};
