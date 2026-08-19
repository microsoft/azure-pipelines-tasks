// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { TestEnvVars } from './testconstants';

/** Shared test fixture directory containing a dummy credprovider JAR. */
let testJarDir: string | null = null;

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
    }

    /**
     * Clean up the test JAR fixture directory.
     */
    static afterEach(): void {
        if (testJarDir && fs.existsSync(testJarDir)) {
            fs.rmSync(testJarDir, { recursive: true, force: true });
            testJarDir = null;
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
