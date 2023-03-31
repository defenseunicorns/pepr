// rollup.config.js
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import { visualizer } from 'rollup-plugin-visualizer';

export default {
    external: [
        /@kubernetes\/client-node(\/.*)?/,
        'fast-json-patch',
        'ramda',
    ],
    input: 'src/fixtures/default.ts',
    output: {
        dir: 'dist',
        format: 'cjs',
        sourcemap: true,
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
