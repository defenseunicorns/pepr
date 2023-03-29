// rollup.config.js
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import { visualizer } from 'rollup-plugin-visualizer';

export default {
    external: [
        /@kubernetes\/client-node(\/.*)?/,
        'fast-json-patch',
        'ramda',
    ],
    input: 'fixtures/default.ts',
    output: {
        dir: 'dist',
        format: 'cjs',
        sourcemap: true,
    },
    plugins: [
        resolve({
            preferBuiltins: true,
        }),
        commonjs(),
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
