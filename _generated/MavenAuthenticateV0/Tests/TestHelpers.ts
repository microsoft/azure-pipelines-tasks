// Test helper functions for MavenAuthenticate L0 tests

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { TestEnvVars } from './TestConstants';

/**
 * Helper functions for Maven L0 tests
 */
export class TestHelpers {
    /**
     * Setup test environment (beforeEach)
     * Clears all test configuration environment variables
     */
    static beforeEach(): void {
        Object.values(TestEnvVars).forEach(envVar => {
            delete process.env[envVar];
        });
        
        delete process.env['SYSTEM_ACCESSTOKEN'];
        delete process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'];
        delete process.env['SYSTEM_DEBUG'];
    }

    /**
     * Cleanup after tests (afterEach)
     */
    static afterEach(): void {
        // Clear test configuration env vars
        Object.values(TestEnvVars).forEach(envVar => {
            delete process.env[envVar];
        });
        TestHelpers.cleanupTestFiles();
    }

    /**
     * Return the path to the settings.xml written during tests.
     * Mirrors the path computed in TestSetup.ts.
     */
    static getSettingsXmlPath(): string {
        return path.join(__dirname, 'testhome', '.m2', 'settings.xml');
    }

    /**
     * Delete any settings.xml (and backup) written during the test run.
     */
    static cleanupTestFiles(): void {
        const settingsXmlPath = TestHelpers.getSettingsXmlPath();
        if (fs.existsSync(settingsXmlPath)) {
            fs.unlinkSync(settingsXmlPath);
        }
        const backupPath = path.join(__dirname, 'testhome', '.m2', '_settings.xml');
        if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
        }
    }

    /**
     * Read the settings.xml file written by the task and return its content.
     * Returns null if the file was not written.
     */
    static readSettingsXml(): string | null {
        const settingsXmlPath = TestHelpers.getSettingsXmlPath();
        if (!fs.existsSync(settingsXmlPath)) {
            return null;
        }
        return fs.readFileSync(settingsXmlPath, 'utf-8');
    }

    /**
     * Assert that the task succeeded
     */
    static assertSuccess(tr: ttm.MockTestRunner, message?: string): void {
        assert(tr.succeeded, message || "Task should succeed");
    }

    /**
     * Assert that the task failed
     */
    static assertFailure(tr: ttm.MockTestRunner, message?: string): void {
        assert(tr.failed, message || "Task should fail");
    }

    /**
     * Assert that task output contains a specific string
     */
    static assertOutputContains(tr: ttm.MockTestRunner, expectedString: string, message?: string): void {
        assert(
            tr.stdOutContained(expectedString),
            message || `Output should contain: ${expectedString}`
        );
    }

    /**
     * Assert that task output does not contain a specific string
     */
    static assertOutputDoesNotContain(tr: ttm.MockTestRunner, unexpectedString: string, message?: string): void {
        assert(
            !tr.stdOutContained(unexpectedString),
            message || `Output should not contain: ${unexpectedString}`
        );
    }

    /**
     * Assert that a warning message is logged
     */
    static assertWarningLogged(tr: ttm.MockTestRunner, warningMessage: string, message?: string): void {
        TestHelpers.assertOutputContains(
            tr,
            warningMessage,
            message || `Should log warning: ${warningMessage}`
        );
    }
}
