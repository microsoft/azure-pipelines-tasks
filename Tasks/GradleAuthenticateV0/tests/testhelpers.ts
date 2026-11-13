// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { TestData, TestEnvVars } from './testconstants';

/** Shared test fixture directory containing a dummy credprovider JAR. */
let testJarDir: string | null = null;
const overrideVariables = [
    'GRADLE_CREDPROVIDER_HOME',
    'GRADLE_USER_HOME',
    'ARTIFACTS_GRADLE_AUTH_CI_PLUGIN_REPO',
    'ARTIFACTS_GRADLE_AUTH_CONFIG',
];
let originalOverrides: Record<string, string | undefined> = {};

/**
 * Shared test helpers — cleanup and assertion utilities.
 */
export class TestHelpers {
    /**
     * Reset all test env vars before each test so scenarios are isolated.
     * Creates a temp directory with a dummy credprovider JAR and sets
     * GRADLE_CREDPROVIDER_HOME so the task can resolve a JAR.
     */
    static beforeEach(): void {
        originalOverrides = {};
        for (const name of overrideVariables) {
            originalOverrides[name] = process.env[name];
            delete process.env[name];
        }
        Object.values(TestEnvVars).forEach(envVar => {
            delete process.env[envVar];
        });

        // Create a temp directory with a dummy JAR for tests
        testJarDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gradle-test-jar-'));
        fs.writeFileSync(
            path.join(testJarDir, 'artifacts-gradle-credprovider-1.0.0.jar'),
            'dummy-jar-content'
        );
        process.env['GRADLE_CREDPROVIDER_HOME'] = testJarDir;
        process.env[TestEnvVars.agentTempDirectory] = path.join(testJarDir, 'agent-temp');
        process.env[TestEnvVars.gradleUserHome] = path.join(testJarDir, 'gradle-home');
    }

    /**
     * Clean up the test JAR fixture directory.
     */
    static afterEach(): void {
        if (testJarDir && fs.existsSync(testJarDir)) {
            fs.rmSync(testJarDir, { recursive: true, force: true });
            testJarDir = null;
        }
        Object.values(TestEnvVars).forEach(envVar => {
            delete process.env[envVar];
        });
        for (const name of overrideVariables) {
            if (originalOverrides[name] === undefined) {
                delete process.env[name];
            } else {
                process.env[name] = originalOverrides[name];
            }
        }
    }

    static assertSuccess(tr: ttm.MockTestRunner, message?: string): void {
        assert.strictEqual(tr.succeeded, true,
            message || `Task should have succeeded.\nStdout:\n${tr.stdout}\nStderr:\n${tr.stderr}`);
    }

    static assertFailure(tr: ttm.MockTestRunner, message?: string): void {
        assert.strictEqual(tr.failed, true,
            message || `Task should have failed.\nStdout:\n${tr.stdout}\nStderr:\n${tr.stderr}`);
    }

    static stagedRepo(tr: ttm.MockTestRunner): string {
        const match = tr.stdout.match(/##vso\[task\.setvariable variable=ARTIFACTS_GRADLE_AUTH_CI_PLUGIN_REPO;[^\]]*\]([^\r\n]+)/);
        assert.ok(match, `Expected exported repository path.\n${tr.stdout}`);
        return match[1];
    }

    static initScriptIdentity(tr: ttm.MockTestRunner): string {
        const command = new RegExp(`##vso\\[task\\.settaskvariable variable=${TestData.initScriptIdentityVariable};[^\\]]*\\]([^\\r\\n]+)`);
        const match = tr.stdout.match(command);
        assert.ok(match, `Expected init script identity task variable.\n${tr.stdout}`);
        return match[1];
    }

    static assertOutputContains(tr: ttm.MockTestRunner, expected: string, message?: string): void {
        assert.ok(tr.stdout.indexOf(expected) >= 0,
            message || `Expected stdout to contain "${expected}".\nActual stdout:\n${tr.stdout}`);
    }

    static assertOutputDoesNotContain(tr: ttm.MockTestRunner, unexpected: string, message?: string): void {
        assert.ok(tr.stdout.indexOf(unexpected) < 0,
            message || `Expected stdout NOT to contain "${unexpected}".\nActual stdout:\n${tr.stdout}`);
    }

    static assertWarningContains(tr: ttm.MockTestRunner, expected: string, message?: string): void {
        const found = tr.warningIssues.some(w => w.indexOf(expected) >= 0);
        assert.ok(found,
            message || `Expected a warning containing "${expected}".\nWarnings:\n${tr.warningIssues.join('\n')}`);
    }
}
