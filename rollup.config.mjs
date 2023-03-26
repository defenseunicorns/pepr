// rollup.config.js
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

export default {
    external: ['@kubernetes/client-node/dist', '@kubernetes/client-node'],
    input: 'fixtures/default.ts',
    output: {
        dir: 'dist',
        format: 'cjs',
    },
    plugins: [
        typescript({
            tsconfig: "./tsconfig.json",
            declaration: false,
            sourceMap: false,
        }),
        terser({
            keep_classnames: true,
            keep_fnames: true,
        })
    ],
    treeshake: true,
};
