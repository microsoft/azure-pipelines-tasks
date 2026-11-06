import { TestHelpers } from './TestHelpers';
import { TestData, TestEnvVars } from './TestConstants';
import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

describe('NpmAuthenticate L0 - Global configuration lifecycle', function () {
    this.timeout(20000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    const scenarios = ['lifecycle', 'missing', 'relative', 'resolution', 'selection', 'replacement', 'sections'];
    if (process.platform === 'win32') {
        scenarios.push('permissions');
    }
    for (const scenario of scenarios) {
        it(`handles ${scenario} without modifying the source or hiding failures`, async function () {
            const root = TestHelpers.createTempDir('npm-global-l0-');
            const tr = await TestHelpers.runTestWithEnv({
                [TestEnvVars.globalTestRoot]: root,
                [TestEnvVars.globalScenario]: scenario,
                ...(scenario === 'resolution' ? { [TestEnvVars.globalResolutionFailure]: 'true' } : {})
            }, 'TestSetupGlobalConfig.js');
            TestHelpers.assertSuccess(tr);
            TestHelpers.assertOutputNotContains(tr, 'sensitive diagnostic');
        });
    }

    for (const failure of [false, true]) {
        it(`keeps workingFile unchanged when opt-in execution ${failure ? 'fails' : 'succeeds'}`, async function () {
            const root = TestHelpers.createTempDir('npm-global-main-');
            const source = path.join(root, 'original.npmrc');
            const globalContents = '# existing global settings\nproxy=https://proxy.example/\n';
            fs.writeFileSync(source, globalContents);
            const original = '# project\nregistry=' + TestData.collectionUri + '_packaging/Feed/npm/registry\n';
            const workingFile = TestHelpers.createTempNpmrc(original);
            const tr = await TestHelpers.runTestWithEnv({
                [TestEnvVars.npmrcPath]: workingFile,
                [TestEnvVars.useGlobalConfig]: 'true',
                [TestEnvVars.globalTestRoot]: root,
                [TestEnvVars.globalSourcePath]: source,
                ...(failure ? { [TestEnvVars.globalResolutionFailure]: 'true' } : {})
            });
            if (failure) {
                TestHelpers.assertFailure(tr);
            } else {
                TestHelpers.assertSuccess(tr);
                const directories = fs.readdirSync(root).filter(name => name.startsWith('npmAuthenticate-global-'));
                assert.strictEqual(directories.length, 1);
                const generated = fs.readFileSync(path.join(root, directories[0], '.npmrc'), 'utf8');
                assert(generated.includes('_authToken=' + TestData.systemAccessToken));
                assert(generated.includes('proxy=https://proxy.example/'));
                assert(!generated.includes('# existing global settings'));
            }
            assert.strictEqual(fs.readFileSync(workingFile, 'utf8'), original);
            assert.strictEqual(fs.readFileSync(source, 'utf8'), globalContents);
            TestHelpers.assertOutputNotContains(tr, 'sensitive diagnostic');
        });
    }
});
