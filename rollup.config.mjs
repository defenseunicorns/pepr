// rollup.config.js
import json from '@rollup/plugin-json';
import typescript from '@rollup/plugin-typescript';

export default {
    external: [
        'pepr',
    ],
    input: {
        cli: 'src/cli/index.ts',
        controller: 'src/controller/index.ts',
        core: 'index.ts',
    },
    output: {
        dir: 'dist',
        format: 'cjs',
        entryFileNames: 'pepr-[name].js',
        banner: '#!/usr/bin/env node',
    },
    plugins: [
        json(),
        typescript({
            tsconfig: "./tsconfig.json",
        }),
    ],
    treeshake: true,
};
