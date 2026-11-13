// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import * as path from 'path';
import * as fs from 'fs';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import { TestData, TestEnvVars } from './testconstants';
import { TestHelpers } from './testhelpers';

describe('GradleAuthenticate L0 - Environment Setup', function () {
    this.timeout(20000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    function configuredRunner(): ttm.MockTestRunner {
        process.env[TestEnvVars.repositoryUrl] = 'https://pkgs.dev.azure.com/testorg/_packaging/feed/maven/v1';
        process.env[TestEnvVars.pluginToolVersion] = '1.0.0';
        return new ttm.MockTestRunner(path.join(__dirname, 'testsetup.js'));
    }

    it('should use canonical paths for agent and Gradle home fixtures', () => {
        const fixtureRoot = process.env['GRADLE_CREDPROVIDER_HOME']!;
        assert.strictEqual(path.relative(fs.realpathSync(fixtureRoot), fixtureRoot), '');
        assert.strictEqual(path.dirname(process.env[TestEnvVars.agentTempDirectory]!), fixtureRoot);
        assert.strictEqual(path.dirname(process.env[TestEnvVars.gradleUserHome]!), fixtureRoot);
    });

    it('should isolate jobs beneath Agent.TempDirectory', async () => {
        const first = configuredRunner();
        await first.runAsync();
        TestHelpers.assertSuccess(first);
        process.env[TestEnvVars.jobId] = TestData.otherJobId;
        const second = configuredRunner();
        await second.runAsync();
        TestHelpers.assertSuccess(second);

        const firstRepo = TestHelpers.stagedRepo(first);
        const secondRepo = TestHelpers.stagedRepo(second);
        assert.notStrictEqual(firstRepo, secondRepo);
        assert.strictEqual(path.dirname(path.dirname(path.normalize(firstRepo))),
            process.env[TestEnvVars.agentTempDirectory]);
        assert.match(path.basename(firstRepo), /^repo-[a-zA-Z0-9]{6}$/);
        assert.ok(fs.existsSync(firstRepo));
        assert.ok(fs.existsSync(secondRepo));
    });

    it('should reuse the job repository and preserve versions and auth entries', async () => {
        const first = configuredRunner();
        await first.runAsync();
        TestHelpers.assertSuccess(first);
        const repoDir = TestHelpers.stagedRepo(first);

        const second = configuredRunner();
        process.env[TestEnvVars.pluginToolVersion] = '2.0.0';
        process.env[TestEnvVars.repositoryUrl] = 'https://pkgs.dev.azure.com/testorg/_packaging/second/maven/v1';
        await second.runAsync();
        TestHelpers.assertSuccess(second);
        assert.strictEqual(TestHelpers.stagedRepo(second), repoDir);

        for (const version of ['1.0.0', '2.0.0']) {
            assert.ok(fs.existsSync(path.join(repoDir, 'com', 'microsoft', 'azure',
                'artifacts-gradle-credprovider', version, `artifacts-gradle-credprovider-${version}.jar`)));
        }
        const config = fs.readFileSync(path.join(repoDir, 'azure-artifacts-auth-config.json'), 'utf-8');
        assert.ok(config.includes('/_packaging/feed/'));
        assert.ok(config.includes('/_packaging/second/'));
        const scripts = fs.readdirSync(path.join(process.env[TestEnvVars.gradleUserHome]!, 'init.d'));
        assert.strictEqual(scripts.length, 1, 'Same-job reuse must not install duplicate init scripts');
    });

    it('should ignore an inherited repository path', async () => {
        const runner = configuredRunner();
        const invalidRepo = path.join(process.env['GRADLE_CREDPROVIDER_HOME']!, 'not-a-directory');
        fs.writeFileSync(invalidRepo, 'file');
        process.env[TestEnvVars.existingRepoDir] = invalidRepo;
        await runner.runAsync();
        TestHelpers.assertSuccess(runner);
        assert.notStrictEqual(TestHelpers.stagedRepo(runner), invalidRepo);
        assert.strictEqual(fs.readFileSync(invalidRepo, 'utf8'), 'file');
    });

    it('should fail rather than fall back to unmanaged OS temp storage', async () => {
        const runner = configuredRunner();
        delete process.env[TestEnvVars.agentTempDirectory];
        await runner.runAsync();
        TestHelpers.assertFailure(runner);
        TestHelpers.assertOutputContains(runner, 'Error_AgentTempUnavailable');
    });

    it('should rely on agent filesystem isolation rather than enforce directory permission masks', async () => {
        const runner = configuredRunner();
        const root = process.env[TestEnvVars.agentTempDirectory]!;
        fs.mkdirSync(root, { mode: 0o777 });
        fs.chmodSync(root, 0o777);
        await runner.runAsync();
        TestHelpers.assertSuccess(runner);
    });

    it('should isolate retries of the same job', async () => {
        const first = configuredRunner();
        await first.runAsync();
        TestHelpers.assertSuccess(first);
        process.env[TestEnvVars.jobAttempt] = '2';
        const second = configuredRunner();
        await second.runAsync();
        TestHelpers.assertSuccess(second);
        assert.notStrictEqual(TestHelpers.stagedRepo(first), TestHelpers.stagedRepo(second));
        assert.strictEqual(fs.readdirSync(path.join(process.env[TestEnvVars.gradleUserHome]!, 'init.d')).length, 2);
    });

    it('should reject a junction at the job staging path before writing provider files', async () => {
        const runner = configuredRunner();
        const victim = path.join(process.env['GRADLE_CREDPROVIDER_HOME']!, 'unowned');
        fs.mkdirSync(victim);
        fs.writeFileSync(path.join(victim, 'keep.txt'), 'unchanged');
        const root = process.env[TestEnvVars.agentTempDirectory]!;
        fs.mkdirSync(root);
        const repo = path.join(root, `gradle-auth-${TestData.jobId}-1`);
        fs.symlinkSync(victim, repo, 'junction');
        try {
            await runner.runAsync();
            TestHelpers.assertFailure(runner);
            TestHelpers.assertOutputContains(runner, 'Error_UnsafeJobPath');
            TestHelpers.assertOutputDoesNotContain(runner, '##vso[task.setvariable variable=ARTIFACTS_GRADLE_AUTH_CI_PLUGIN_REPO;');
            TestHelpers.assertOutputDoesNotContain(runner, '##vso[task.setvariable variable=ARTIFACTS_GRADLE_AUTH_CONFIG;');
            assert.deepStrictEqual(fs.readdirSync(victim), ['keep.txt']);
        } finally {
            fs.unlinkSync(repo);
        }
    });

    it('should reject an unrecognized existing job directory instead of adopting it', async () => {
        const runner = configuredRunner();
        const directory = path.join(process.env[TestEnvVars.agentTempDirectory]!, `gradle-auth-${TestData.jobId}-1`);
        fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
        fs.writeFileSync(path.join(directory, 'keep.txt'), 'unchanged');
        await runner.runAsync();
        TestHelpers.assertFailure(runner);
        TestHelpers.assertOutputContains(runner, 'Error_UnownedJobResource');
        assert.deepStrictEqual(fs.readdirSync(directory), ['keep.txt']);
    });

    it('should reject a repository record that escapes its job namespace', async () => {
        const first = configuredRunner();
        await first.runAsync();
        TestHelpers.assertSuccess(first);
        const repository = TestHelpers.stagedRepo(first);
        fs.writeFileSync(path.join(path.dirname(repository), 'repository.json'), JSON.stringify('../outside'));
        const second = configuredRunner();
        await second.runAsync();
        TestHelpers.assertFailure(second);
        TestHelpers.assertOutputContains(second, 'Error_UnownedJobResource');
    });

    it('should reject a junction replacing the recorded repository before writing provider files', async () => {
        const first = configuredRunner();
        await first.runAsync();
        TestHelpers.assertSuccess(first);
        const repository = TestHelpers.stagedRepo(first);
        const victim = path.join(process.env['GRADLE_CREDPROVIDER_HOME']!, 'unowned');
        fs.mkdirSync(victim);
        fs.writeFileSync(path.join(victim, 'keep.txt'), 'unchanged');
        fs.renameSync(repository, `${repository}-original`);
        fs.symlinkSync(victim, repository, 'junction');
        try {
            const second = configuredRunner();
            await second.runAsync();
            TestHelpers.assertFailure(second);
            TestHelpers.assertOutputContains(second, 'Error_UnsafeJobPath');
            assert.deepStrictEqual(fs.readdirSync(victim), ['keep.txt']);
        } finally {
            fs.unlinkSync(repository);
        }
    });

    it('should resolve a linked Gradle-home ancestor before creating nested directories', async () => {
        const runner = configuredRunner();
        const target = path.join(process.env['GRADLE_CREDPROVIDER_HOME']!, 'home-parent');
        const link = path.join(process.env['GRADLE_CREDPROVIDER_HOME']!, 'redirect');
        fs.mkdirSync(target);
        fs.writeFileSync(path.join(target, 'keep.txt'), 'unchanged');
        fs.symlinkSync(target, link, 'junction');
        process.env[TestEnvVars.gradleUserHome] = path.join(link, 'nested', 'home');
        try {
            await runner.runAsync();
            TestHelpers.assertSuccess(runner);
            const home = path.join(target, 'nested', 'home');
            const script = path.join(home, 'init.d', `azure-artifacts-init-${TestData.jobId}-1.gradle`);
            assert.strictEqual(fs.existsSync(script), true);
            assert.strictEqual(JSON.parse(TestHelpers.initScriptIdentity(runner)).gradleUserHome, home);
            assert.strictEqual(fs.readFileSync(path.join(target, 'keep.txt'), 'utf8'), 'unchanged');
        } finally {
            fs.unlinkSync(link);
        }
    });

    for (const useEnvironment of [false, true]) {
        it(`should resolve an existing linked Gradle home selected through ${useEnvironment ? 'the environment' : 'the input'}`, async () => {
            const home = process.env[TestEnvVars.gradleUserHome]!;
            const link = `${home}-link`;
            fs.mkdirSync(home);
            fs.symlinkSync(home, link, 'junction');
            if (useEnvironment) {
                delete process.env[TestEnvVars.gradleUserHome];
                process.env['GRADLE_USER_HOME'] = link;
            } else {
                process.env[TestEnvVars.gradleUserHome] = link;
            }
            try {
                const runner = configuredRunner();
                await runner.runAsync();
                TestHelpers.assertSuccess(runner);
                assert.strictEqual(JSON.parse(TestHelpers.initScriptIdentity(runner)).gradleUserHome, fs.realpathSync(home));
                assert.strictEqual(fs.existsSync(path.join(home, 'init.d',
                    `azure-artifacts-init-${TestData.jobId}-1.gradle`)), true);
            } finally {
                fs.unlinkSync(link);
            }
        });
    }

    it('should still reject a linked init.d beneath the resolved Gradle home', async () => {
        const home = process.env[TestEnvVars.gradleUserHome]!;
        const target = `${home}-init`;
        fs.mkdirSync(home);
        fs.mkdirSync(target);
        fs.writeFileSync(path.join(target, 'keep.txt'), 'unchanged');
        fs.symlinkSync(target, path.join(home, 'init.d'), 'junction');
        try {
            const runner = configuredRunner();
            await runner.runAsync();
            TestHelpers.assertFailure(runner);
            TestHelpers.assertOutputContains(runner, 'Error_UnsafeJobPath');
            assert.deepStrictEqual(fs.readdirSync(target), ['keep.txt']);
        } finally {
            fs.unlinkSync(path.join(home, 'init.d'));
        }
    });

    it('should resolve a linked Agent.TempDirectory and reuse its physical repository', async () => {
        const root = process.env[TestEnvVars.agentTempDirectory]!;
        const target = `${root}-physical`;
        fs.mkdirSync(target);
        fs.writeFileSync(path.join(target, 'keep.txt'), 'unchanged');
        fs.symlinkSync(target, root, 'junction');
        try {
            const runner = configuredRunner();
            await runner.runAsync();
            TestHelpers.assertSuccess(runner);
            const repository = path.normalize(TestHelpers.stagedRepo(runner));
            assert.strictEqual(path.dirname(path.dirname(repository)), fs.realpathSync(target));
            TestHelpers.assertOutputContains(runner, path.join(repository, 'azure-artifacts-auth-config.json'));
            process.env[TestEnvVars.existingRepoDir] = TestHelpers.stagedRepo(runner);
            const second = configuredRunner();
            await second.runAsync();
            TestHelpers.assertSuccess(second);
            assert.strictEqual(TestHelpers.stagedRepo(second), TestHelpers.stagedRepo(runner));
            assert.strictEqual(fs.readFileSync(path.join(target, 'keep.txt'), 'utf8'), 'unchanged');
        } finally {
            fs.unlinkSync(root);
        }
    });

    it('should resolve an agent work-folder link before creating the temporary root', async () => {
        const fixture = process.env['GRADLE_CREDPROVIDER_HOME']!;
        const work = path.join(fixture, 'work');
        const alias = path.join(fixture, 'work-alias');
        fs.mkdirSync(work);
        fs.symlinkSync(work, alias, 'junction');
        process.env[TestEnvVars.agentTempDirectory] = path.join(alias, '_temp');
        try {
            const runner = configuredRunner();
            await runner.runAsync();
            TestHelpers.assertSuccess(runner);
            const repository = path.normalize(TestHelpers.stagedRepo(runner));
            assert.strictEqual(path.dirname(path.dirname(repository)), path.join(fs.realpathSync(work), '_temp'));
            assert.ok(fs.existsSync(path.join(repository, 'azure-artifacts-auth-config.json')));
        } finally {
            fs.unlinkSync(alias);
        }
    });

    it('should reuse the repository when the temp-root spelling changes but its physical location does not', async () => {
        const root = process.env[TestEnvVars.agentTempDirectory]!;
        const alias = `${root}-alias`;
        fs.mkdirSync(root);
        fs.symlinkSync(root, alias, 'junction');
        try {
            const first = configuredRunner();
            await first.runAsync();
            TestHelpers.assertSuccess(first);
            process.env[TestEnvVars.existingRepoDir] = TestHelpers.stagedRepo(first);
            process.env[TestEnvVars.agentTempDirectory] = alias;
            const second = configuredRunner();
            await second.runAsync();
            TestHelpers.assertSuccess(second);
            assert.strictEqual(TestHelpers.stagedRepo(second), TestHelpers.stagedRepo(first));
        } finally {
            fs.unlinkSync(alias);
        }
    });

    it('should ignore an inherited same-job repository under another temporary root', async () => {
        const fixture = process.env['GRADLE_CREDPROVIDER_HOME']!;
        const unowned = path.join(fixture, 'unowned', `gradle-auth-${TestData.jobId}-1`, 'repo-Ab1234');
        fs.mkdirSync(unowned, { recursive: true });
        fs.writeFileSync(path.join(unowned, 'keep.txt'), 'unchanged');
        process.env[TestEnvVars.existingRepoDir] = unowned;
        const runner = configuredRunner();
        await runner.runAsync();
        TestHelpers.assertSuccess(runner);
        assert.notStrictEqual(path.normalize(TestHelpers.stagedRepo(runner)), unowned);
        assert.strictEqual(path.dirname(path.dirname(path.normalize(TestHelpers.stagedRepo(runner)))),
            process.env[TestEnvVars.agentTempDirectory]);
        assert.deepStrictEqual(fs.readdirSync(unowned), ['keep.txt']);
    });

    it('should reject a linked job directory beneath a linked agent temporary root', async () => {
        const root = process.env[TestEnvVars.agentTempDirectory]!;
        const target = `${root}-physical`;
        const unowned = `${root}-unowned`;
        fs.mkdirSync(target);
        fs.mkdirSync(unowned);
        fs.writeFileSync(path.join(unowned, 'keep.txt'), 'unchanged');
        const job = path.join(target, `gradle-auth-${TestData.jobId}-1`);
        fs.symlinkSync(target, root, 'junction');
        fs.symlinkSync(unowned, job, 'junction');
        try {
            const runner = configuredRunner();
            await runner.runAsync();
            TestHelpers.assertFailure(runner);
            TestHelpers.assertOutputContains(runner, 'Error_UnsafeJobPath');
            assert.deepStrictEqual(fs.readdirSync(unowned), ['keep.txt']);
        } finally {
            fs.unlinkSync(job);
            fs.unlinkSync(root);
        }
    });

    for (const dangling of [false, true]) {
        it(`should reject ${dangling ? 'a dangling link' : 'a regular file'} as the agent temporary root`, async () => {
            const root = process.env[TestEnvVars.agentTempDirectory]!;
            if (dangling) {
                fs.symlinkSync(`${root}-missing`, root, 'junction');
            } else {
                fs.writeFileSync(root, 'unchanged');
            }
            try {
                const runner = configuredRunner();
                await runner.runAsync();
                TestHelpers.assertFailure(runner);
                TestHelpers.assertOutputDoesNotContain(runner, '##vso[task.setvariable variable=ARTIFACTS_GRADLE_AUTH_CI_PLUGIN_REPO;');
                if (!dangling) assert.strictEqual(fs.readFileSync(root, 'utf8'), 'unchanged');
            } finally {
                fs.unlinkSync(root);
            }
        });
    }

    it('should refresh a regular job-specific init script without creating receipt files', async () => {
        const runner = configuredRunner();
        const directory = path.join(process.env[TestEnvVars.gradleUserHome]!, 'init.d');
        fs.mkdirSync(directory, { recursive: true });
        const script = path.join(directory, `azure-artifacts-init-${TestData.jobId}-1.gradle`);
        fs.writeFileSync(script, '// pre-existing, not created by this task');
        await runner.runAsync();
        TestHelpers.assertSuccess(runner);
        assert.ok(fs.readFileSync(script, 'utf8').includes('ARTIFACTS_GRADLE_AUTH_CI_PLUGIN_REPO'));
        const identity = JSON.parse(TestHelpers.initScriptIdentity(runner));
        const stat = fs.lstatSync(script, { bigint: true });
        assert.deepStrictEqual(identity, {
            device: stat.dev.toString(),
            inode: stat.ino.toString(),
            gradleUserHome: path.resolve(process.env[TestEnvVars.gradleUserHome]!),
        });
        const jobDirectory = path.dirname(TestHelpers.stagedRepo(runner));
        assert.ok(fs.readdirSync(jobDirectory).every(name => !name.startsWith('init-script-')));
    });

    it('should not reuse an inherited repository from a different job', async () => {
        const first = configuredRunner();
        await first.runAsync();
        TestHelpers.assertSuccess(first);
        const repo = TestHelpers.stagedRepo(first);
        const originalConfig = fs.readFileSync(path.join(repo, 'azure-artifacts-auth-config.json'), 'utf8');
        process.env[TestEnvVars.existingRepoDir] = repo;
        process.env[TestEnvVars.jobId] = TestData.otherJobId;
        const second = configuredRunner();
        await second.runAsync();
        TestHelpers.assertSuccess(second);
        assert.notStrictEqual(TestHelpers.stagedRepo(second), repo);
        assert.strictEqual(fs.readFileSync(path.join(repo, 'azure-artifacts-auth-config.json'), 'utf8'), originalConfig);
    });

    it('should set ARTIFACTS_GRADLE_AUTH_CI_PLUGIN_REPO and ARTIFACTS_GRADLE_AUTH_CONFIG', async () => {
        const tp = path.join(__dirname, 'testsetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.repositoryUrl] = 'https://pkgs.dev.azure.com/testorg/_packaging/feed/maven/v1';
        process.env[TestEnvVars.pluginToolVersion] = '1.0.0';

        await tr.runAsync();

        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputContains(tr, 'ARTIFACTS_GRADLE_AUTH_CI_PLUGIN_REPO');
        TestHelpers.assertOutputContains(tr, 'ARTIFACTS_GRADLE_AUTH_CONFIG');
    });

    it('should write init script and report success', async () => {
        const tp = path.join(__dirname, 'testsetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.repositoryUrl] = 'https://pkgs.dev.azure.com/testorg/_packaging/feed/maven/v1';
        process.env[TestEnvVars.pluginToolVersion] = '1.0.0';

        await tr.runAsync();

        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputContains(tr, 'Info_InitScriptWritten');
        TestHelpers.assertOutputContains(tr, 'Info_SuccessResult');
    });

    it('should lay out Maven repo with correct version', async () => {
        const tp = path.join(__dirname, 'testsetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[TestEnvVars.repositoryUrl] = 'https://pkgs.dev.azure.com/testorg/_packaging/feed/maven/v1';
        process.env[TestEnvVars.pluginToolVersion] = '3.2.1';

        await tr.runAsync();

        TestHelpers.assertSuccess(tr);
        TestHelpers.assertOutputContains(tr, 'Info_MavenRepoLaidOut');
    });
});
