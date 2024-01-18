// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2023-Present The Pepr Authors

import { describe, expect, jest, it } from "@jest/globals";
import { execSync, spawnSync } from "child_process";;
import { promises as fs } from 'fs';

import {
    waitForDeploymentReady,
} from "./k8s";

jest.setTimeout(1000 * 60 * 5);

export function peprUpgrade() {

    it("should prepare, build, and deploy hello-pepr with pepr@latest", async () => {
        try {
            // Install pepr@latest
            execSync("npm i pepr@latest", { cwd: "pepr-upgrade-test", stdio: "inherit" })

            // Update manifests of pepr@latest
            execSync("node ./node_modules/pepr/dist/cli.js update --skip-template-update", { cwd: "pepr-upgrade-test", stdio: "inherit" });

            // Generate manifests with pepr@latest
            execSync("node ./node_modules/pepr/dist/cli.js build", { cwd: "pepr-upgrade-test", stdio: "inherit" });

            // Deploy manifests of pepr@latest
            execSync("kubectl create -f dist/pepr-module-3b1b7ed6-88f6-54ec-9ae0-0dcc8a432456.yaml", { cwd: "pepr-upgrade-test", stdio: "inherit" });

            // Wait for the deployments to be ready
            await Promise.all([waitForDeploymentReady("pepr-system", "pepr-3b1b7ed6-88f6-54ec-9ae0-0dcc8a432456"), waitForDeploymentReady("pepr-system", "pepr-3b1b7ed6-88f6-54ec-9ae0-0dcc8a432456-watcher")]);
        }
        catch (error) {
            expect(error).toBeNull();
        }

    });

    it("should prepare, build, and deploy hello-pepr with pepr@pr-candidate", async () => {

        try {
            // Re-generate manifests with pepr@pr-candidate
            execSync("npx ts-node ../src/cli.ts build", { cwd: "pepr-upgrade-test", stdio: "inherit" });

            // // Replace pepr@latest with pepr@pr-candidate image pepr:dev
            await replaceString("pepr-upgrade-test/dist/pepr-module-3b1b7ed6-88f6-54ec-9ae0-0dcc8a432456.yaml", "ghcr.io/defenseunicorns/pepr/controller:v0.0.0-development", "pepr:dev");

            // Deploy manifests of pepr@latest
            const applyOut = spawnSync("kubectl apply -f dist/pepr-module-3b1b7ed6-88f6-54ec-9ae0-0dcc8a432456.yaml", {
                shell: true,
                encoding: "utf-8",
                cwd: "pepr-upgrade-test",
            });

            const { status } = applyOut;

            // Validation should not return an error
            expect(status).toBe(0);

            // Wait for the deployments to be ready
            await Promise.all([waitForDeploymentReady("pepr-system", "pepr-3b1b7ed6-88f6-54ec-9ae0-0dcc8a432456"), waitForDeploymentReady("pepr-system", "pepr-3b1b7ed6-88f6-54ec-9ae0-0dcc8a432456-watcher")]);
        }
        catch (error) {
            expect(error).toBeNull();
        }
    });
}

describe("Should test Pepr upgrade", peprUpgrade)

/**
 * Replace a string in a file and on error throws
 *
 * @param originalString - Original string to replace
 * @param newString - New string to replace with
 */
async function replaceString(filePath: string, originalString: string, newString: string) {
    try {
        let fileContent = await fs.readFile(filePath, 'utf8');
        const modifiedContent = fileContent.split(originalString).join(newString);
        await fs.writeFile(filePath, modifiedContent, 'utf8');
    } catch (error) {
        throw error
    }
}

