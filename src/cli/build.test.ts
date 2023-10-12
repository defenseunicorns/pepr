// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { createDockerfile } from './build';
import { expect, describe, beforeEach, afterEach, test } from "@jest/globals";
import { promises as fs } from 'fs';
import { join } from 'path';
import os from 'os';

describe('createDockerfile', () => {

    let tempDir: string;

    // Create a temporary directory before each test
    beforeEach(async () => {
        tempDir = await fs.mkdtemp(join(os.tmpdir(), 'createDockerfile-test-'));
        process.chdir(tempDir);  // Change current working directory to the temp directory
    });

    // Clean up the temporary directory after each test
    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    test('should create a Dockerfile.controller with the correct content', async () => {
        const version = '0.0.1';
        const description = 'Pepr supports WASM modules!';
        const includedFiles = ['main.wasm', 'wasm_exec.js'];

        await createDockerfile(version, description, includedFiles);

        const generatedContent = await fs.readFile('Dockerfile.controller', 'utf-8');
        expect(generatedContent).toContain(`FROM ghcr.io/defenseunicorns/pepr/controller:v${version}`);
        expect(generatedContent).toContain(`LABEL description="${description}"`);
        includedFiles.forEach(file => {
            expect(generatedContent).toContain(`ADD ${file} /app/node_modules/pepr/dist/${file}`);
        });
    });
});
