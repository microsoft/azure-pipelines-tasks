// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import * as fs from 'fs';
import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as assert from 'assert';
import { TestData, TestEnvVars } from './testconstants';
import { TestHelpers } from './testhelpers';

describe('GradleAuthenticate L0 - Post-Execution Cleanup', function () {
    this.timeout(30000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    function initPath(job = TestData.jobId, attempt = '1'): string {
        return path.join(process.env[TestEnvVars.gradleUserHome]!, 'init.d',
            `azure-artifacts-init-${job}-${attempt}.gradle`);
    }

    function repoPath(): string {
        return path.join(process.env[TestEnvVars.agentTempDirectory]!, `gradle-auth-${TestData.jobId}-1`);
    }

    async function main(invalidVersion = false): Promise<ttm.MockTestRunner> {
        process.env[TestEnvVars.repositoryUrl] = 'https://pkgs.dev.azure.com/testorg/_packaging/feed/maven/v1';
        process.env[TestEnvVars.pluginToolVersion] = invalidVersion ? 'unsafe version' : '1.0.0';
        const runner = new ttm.MockTestRunner(path.join(__dirname, 'testsetup.js'));
        await runner.runAsync();
        if (invalidVersion) TestHelpers.assertFailure(runner);
        else {
            TestHelpers.assertSuccess(runner);
            process.env[TestEnvVars.initScriptIdentity] = TestHelpers.initScriptIdentity(runner);
        }
        return runner;
    }

    async function post(): Promise<ttm.MockTestRunner> {
        const runner = new ttm.MockTestRunner(path.join(__dirname, 'testsetup.postexecution.js'));
        await runner.runAsync();
        TestHelpers.assertSuccess(runner);
        TestHelpers.assertOutputContains(runner, 'ARTIFACTS_GRADLE_AUTH_CONFIG');
        TestHelpers.assertOutputDoesNotContain(runner, 'TEST_DELETE_DIRECTORY');
        return runner;
    }

    function assertNoDeletion(runner: ttm.MockTestRunner): void {
        TestHelpers.assertOutputDoesNotContain(runner, 'TEST_DELETE_FILE');
    }

    function victim(): string {
        const directory = path.join(path.dirname(process.env[TestEnvVars.agentTempDirectory]!), 'unowned');
        fs.mkdirSync(directory);
        fs.writeFileSync(path.join(directory, 'keep.gradle'), 'do not delete');
        process.env[TestEnvVars.postexecTemp] = directory;
        process.env[TestEnvVars.postexecInitScript] = path.join(directory, 'keep.gradle');
        process.env[TestEnvVars.postexecDryRun] = '1';
        return directory;
    }

    it('does not delete anything when the job has no init script', async () => {
        const runner = await post();
        assertNoDeletion(runner);
        assert.deepStrictEqual(runner.warningIssues, []);
    });

    it('ignores injected path variables using the real task-lib environment loader', async () => {
        const directory = victim();
        process.env[TestEnvVars.postexecRealVariables] = '1';
        const runner = await post();
        assertNoDeletion(runner);
        assert.deepStrictEqual(runner.warningIssues, []);
        assert.strictEqual(fs.readFileSync(path.join(directory, 'keep.gradle'), 'utf8'), 'do not delete');
    });

    it('deletes only the computed job script, never conflicting injected paths', async () => {
        await main();
        const directory = victim();
        delete process.env[TestEnvVars.postexecDryRun];
        process.env[TestEnvVars.postexecRealVariables] = '1';
        const otherScript = initPath(TestData.otherJobId);
        fs.writeFileSync(otherScript, '// another job');
        const runner = await post();
        TestHelpers.assertOutputContains(runner, 'TEST_DELETE_FILE');
        assert.strictEqual(fs.existsSync(initPath()), false);
        assert.strictEqual(fs.existsSync(repoPath()), true, 'Staging cleanup belongs to the agent');
        assert.strictEqual(fs.existsSync(otherScript), true);
        assert.strictEqual(fs.existsSync(path.join(directory, 'keep.gradle')), true);
        assertNoDeletion(await post());
    });

    it('leaves staging to the agent after version validation fails', async () => {
        await main(true);
        assert.strictEqual(fs.existsSync(initPath()), false);
        assertNoDeletion(await post());
        assert.strictEqual(fs.existsSync(repoPath()), true);
    });

    it('does not trust injected paths when main fails before setup', async () => {
        victim();
        const runner = new ttm.MockTestRunner(path.join(__dirname, 'testsetup.js'));
        await runner.runAsync();
        TestHelpers.assertFailure(runner);
        process.env[TestEnvVars.postexecRealVariables] = '1';
        assertNoDeletion(await post());
    });

    it('does not trust injected paths after a successful no-feeds invocation', async () => {
        victim();
        process.env[TestEnvVars.repositoryUrl] = 'https://example.com/not-an-artifacts-feed';
        process.env[TestEnvVars.pluginToolVersion] = '1.0.0';
        const runner = new ttm.MockTestRunner(path.join(__dirname, 'testsetup.js'));
        await runner.runAsync();
        TestHelpers.assertSuccess(runner);
        process.env[TestEnvVars.postexecRealVariables] = '1';
        assertNoDeletion(await post());
        assert.strictEqual(fs.existsSync(repoPath()), true);
    });

    for (const [variable, value] of [
        [TestEnvVars.jobId, ''],
        [TestEnvVars.jobId, '..\\outside'],
        [TestEnvVars.jobId, 'C:\\agent-victim-directory'],
        [TestEnvVars.jobAttempt, ''],
        [TestEnvVars.jobAttempt, '0'],
        [TestEnvVars.jobAttempt, '..\\outside'],
    ]) {
        it(`rejects invalid job identity (${variable}=${value})`, async () => {
            await main();
            process.env[variable] = value;
            process.env[TestEnvVars.postexecDryRun] = '1';
            const runner = await post();
            assertNoDeletion(runner);
            TestHelpers.assertWarningContains(runner, 'Warning_PostExecCleanupFailed');
            TestHelpers.assertWarningContains(runner, 'Error_InvalidJobIdentity');
        });
    }

    for (const [variable, value] of [
        [TestEnvVars.jobId, TestData.otherJobId],
        [TestEnvVars.jobAttempt, '2'],
    ]) {
        it(`does not delete another job or attempt's script (${variable}=${value})`, async () => {
            await main();
            process.env[variable] = value;
            assertNoDeletion(await post());
            assert.strictEqual(fs.existsSync(initPath()), true);
        });
    }

    it('never traverses a junction replacing the staging directory', async () => {
        await main();
        const directory = victim();
        fs.renameSync(repoPath(), `${repoPath()}-original`);
        fs.symlinkSync(directory, repoPath(), 'junction');
        delete process.env[TestEnvVars.postexecDryRun];
        try {
            await post();
            assert.strictEqual(fs.existsSync(path.join(directory, 'keep.gradle')), true);
        } finally {
            fs.unlinkSync(repoPath());
        }
    });

    it('rejects a junction replacing an init-script parent', async () => {
        await main();
        const directory = victim();
        const initDirectory = path.dirname(initPath());
        fs.renameSync(initDirectory, `${initDirectory}-original`);
        fs.writeFileSync(path.join(directory, path.basename(initPath())), '// unowned script');
        fs.symlinkSync(directory, initDirectory, 'junction');
        try {
            const runner = await post();
            assertNoDeletion(runner);
            TestHelpers.assertWarningContains(runner, 'Error_UnsafeJobPath');
        } finally {
            fs.unlinkSync(initDirectory);
        }
    });

    it('rejects a junction at the job init-script path', async () => {
        await main();
        const directory = victim();
        fs.renameSync(initPath(), `${initPath()}.original`);
        fs.symlinkSync(directory, initPath(), 'junction');
        try {
            assertNoDeletion(await post());
        } finally {
            fs.unlinkSync(initPath());
        }
    });

    it('deletes the same init script even when its contents were modified', async () => {
        await main();
        fs.writeFileSync(initPath(), '// modified');
        const runner = await post();
        TestHelpers.assertOutputContains(runner, 'TEST_DELETE_FILE');
        assert.deepStrictEqual(runner.warningIssues, []);
        assert.strictEqual(fs.existsSync(initPath()), false);
    });

    it('does not delete a replacement file even when its bytes match the generated script', async () => {
        await main();
        const original = fs.readFileSync(initPath());
        fs.renameSync(initPath(), `${initPath()}.original`);
        fs.writeFileSync(initPath(), original);
        const runner = await post();
        assertNoDeletion(runner);
        TestHelpers.assertWarningContains(runner, 'Error_UnownedJobResource');
        assert.deepStrictEqual(fs.readFileSync(initPath()), original);
    });

    it('does not delete a hard-linked init script', async () => {
        await main();
        fs.linkSync(initPath(), `${initPath()}.link`);
        const runner = await post();
        assertNoDeletion(runner);
        TestHelpers.assertWarningContains(runner, 'Error_UnsafeJobPath');
        assert.strictEqual(fs.existsSync(initPath()), true);
    });

    for (const [setupTime, cleanupTime] of [
        ['0', '0'],
        ['0', undefined],
        [undefined, '0'],
        ['1', '2'],
    ]) {
        it(`cleans the script without relying on creation time (${setupTime} -> ${cleanupTime})`, async () => {
            if (setupTime !== undefined) process.env[TestEnvVars.initScriptBirthtime] = setupTime;
            await main();
            const identity = JSON.parse(process.env[TestEnvVars.initScriptIdentity]!);
            assert.strictEqual('birthtimeNs' in identity, false);
            if (cleanupTime === undefined) delete process.env[TestEnvVars.initScriptBirthtime];
            else process.env[TestEnvVars.initScriptBirthtime] = cleanupTime;
            const runner = await post();
            TestHelpers.assertOutputContains(runner, 'TEST_DELETE_FILE');
            assert.deepStrictEqual(runner.warningIssues, []);
            assert.strictEqual(fs.existsSync(initPath()), false);
        });
    }

    it('does not delete an init script when its task-scoped identity is missing', async () => {
        await main();
        delete process.env[TestEnvVars.initScriptIdentity];
        assertNoDeletion(await post());
        assert.strictEqual(fs.existsSync(initPath()), true);
    });

    for (const content of ['null', '{}', 'not-json',
        '{"device":"1","inode":"2"}',
        '{"device":"1","inode":"2","gradleUserHome":42}',
        '{"device":"1","inode":"2","gradleUserHome":"relative-home"}']) {
        it(`does not delete an init script with an invalid task-scoped identity (${content})`, async () => {
            await main();
            process.env[TestEnvVars.initScriptIdentity] = content;
            const runner = await post();
            assertNoDeletion(runner);
            TestHelpers.assertWarningContains(runner, 'Warning_PostExecCleanupFailed');
            assert.strictEqual(fs.existsSync(initPath()), true);
        });
    }

    it('cleans the recorded home when GRADLE_USER_HOME changes before post-job execution', async () => {
        const originalHome = process.env[TestEnvVars.gradleUserHome]!;
        delete process.env[TestEnvVars.gradleUserHome];
        process.env['GRADLE_USER_HOME'] = originalHome;
        await main();
        const script = path.join(originalHome, 'init.d', `azure-artifacts-init-${TestData.jobId}-1.gradle`);
        const changedHome = path.join(path.dirname(originalHome), 'changed-gradle-home');
        const changedScript = path.join(changedHome, 'init.d', path.basename(script));
        fs.mkdirSync(path.dirname(changedScript), { recursive: true });
        fs.writeFileSync(changedScript, '// unrelated script');
        process.env['GRADLE_USER_HOME'] = changedHome;
        const runner = await post();
        assert.deepStrictEqual(runner.warningIssues, []);
        assert.strictEqual(fs.existsSync(script), false);
        assert.strictEqual(fs.readFileSync(changedScript, 'utf8'), '// unrelated script');
    });

    it('records an absolute home when the input is relative and does not recompute it during cleanup', async () => {
        const originalHome = process.env[TestEnvVars.gradleUserHome]!;
        const script = initPath();
        process.env[TestEnvVars.gradleUserHome] = path.relative(process.cwd(), originalHome);
        await main();
        const identity = JSON.parse(process.env[TestEnvVars.initScriptIdentity]!);
        assert.strictEqual(identity.gradleUserHome, path.resolve(originalHome));
        process.env[TestEnvVars.gradleUserHome] = path.join(path.dirname(originalHome), 'different-home');
        const runner = await post();
        assert.deepStrictEqual(runner.warningIssues, []);
        assert.strictEqual(fs.existsSync(script), false);
    });

    it('keeps independent task identities for different Gradle homes in the same job', async () => {
        await main();
        const firstHome = process.env[TestEnvVars.gradleUserHome]!;
        const firstScript = initPath();
        const firstIdentity = process.env[TestEnvVars.initScriptIdentity];
        process.env[TestEnvVars.gradleUserHome] = path.join(path.dirname(firstHome), 'other-gradle-home');
        await main();
        const secondScript = initPath();
        await post();
        assert.strictEqual(fs.existsSync(secondScript), false);
        assert.strictEqual(fs.existsSync(firstScript), true);
        process.env[TestEnvVars.gradleUserHome] = firstHome;
        process.env[TestEnvVars.initScriptIdentity] = firstIdentity;
        await post();
        assert.strictEqual(fs.existsSync(firstScript), false);
    });

    it('cleans the original physical home after the configured home link is retargeted', async () => {
        const home = process.env[TestEnvVars.gradleUserHome]!;
        const link = `${home}-link`;
        const otherHome = `${home}-other`;
        const script = initPath();
        fs.mkdirSync(home);
        fs.symlinkSync(home, link, 'junction');
        process.env[TestEnvVars.gradleUserHome] = link;
        try {
            await main();
            assert.strictEqual(JSON.parse(process.env[TestEnvVars.initScriptIdentity]!).gradleUserHome, fs.realpathSync(home));
            const otherScript = path.join(otherHome, 'init.d', path.basename(script));
            fs.mkdirSync(path.dirname(otherScript), { recursive: true });
            fs.writeFileSync(otherScript, '// unrelated script');
            fs.unlinkSync(link);
            fs.symlinkSync(otherHome, link, 'junction');
            const runner = await post();
            assert.deepStrictEqual(runner.warningIssues, []);
            assert.strictEqual(fs.existsSync(script), false);
            assert.strictEqual(fs.readFileSync(otherScript, 'utf8'), '// unrelated script');
        } finally {
            fs.unlinkSync(link);
        }
    });

    it('cleans the original physical home even after its configured alias is removed', async () => {
        const home = process.env[TestEnvVars.gradleUserHome]!;
        const script = initPath();
        const link = `${home}-link`;
        fs.mkdirSync(home);
        fs.symlinkSync(home, link, 'junction');
        process.env[TestEnvVars.gradleUserHome] = link;
        try {
            await main();
        } finally {
            fs.unlinkSync(link);
        }
        const runner = await post();
        assert.deepStrictEqual(runner.warningIssues, []);
        assert.strictEqual(fs.existsSync(script), false);
    });

    it('refuses cleanup if the saved physical home is replaced by a link', async () => {
        await main();
        const home = process.env[TestEnvVars.gradleUserHome]!;
        const script = initPath();
        const otherHome = `${home}-other`;
        const otherScript = path.join(otherHome, 'init.d', path.basename(script));
        fs.mkdirSync(path.dirname(otherScript), { recursive: true });
        fs.writeFileSync(otherScript, '// unrelated script');
        fs.renameSync(home, `${home}-original`);
        fs.symlinkSync(otherHome, home, 'junction');
        try {
            const runner = await post();
            assertNoDeletion(runner);
            TestHelpers.assertWarningContains(runner, 'Error_UnsafeJobPath');
            assert.strictEqual(fs.readFileSync(otherScript, 'utf8'), '// unrelated script');
        } finally {
            fs.unlinkSync(home);
        }
    });

    it('does not let an earlier invocation delete a script refreshed by a later invocation', async () => {
        await main();
        const firstIdentity = process.env[TestEnvVars.initScriptIdentity];
        await main();
        const secondIdentity = process.env[TestEnvVars.initScriptIdentity];
        process.env[TestEnvVars.initScriptIdentity] = firstIdentity;
        const earlierPost = await post();
        assertNoDeletion(earlierPost);
        TestHelpers.assertWarningContains(earlierPost, 'Error_UnownedJobResource');
        assert.strictEqual(fs.existsSync(initPath()), true);
        process.env[TestEnvVars.initScriptIdentity] = secondIdentity;
        await post();
        assert.strictEqual(fs.existsSync(initPath()), false);
    });

    it('cleans repeated invocations in normal reverse post-job order without warnings', async () => {
        await main();
        const firstIdentity = process.env[TestEnvVars.initScriptIdentity];
        await main();
        const laterPost = await post();
        assert.deepStrictEqual(laterPost.warningIssues, []);
        assert.strictEqual(fs.existsSync(initPath()), false);
        process.env[TestEnvVars.initScriptIdentity] = firstIdentity;
        const earlierPost = await post();
        assertNoDeletion(earlierPost);
        assert.deepStrictEqual(earlierPost.warningIssues, []);
    });
});
