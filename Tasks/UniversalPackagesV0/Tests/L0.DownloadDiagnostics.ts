import * as assert from 'assert';
import * as path from 'path';
import { spawnSync } from 'child_process';

describe('UniversalPackages L0 Suite - Download diagnostics', function () {
    this.timeout(10000);

    const marker = '##vso[task.setvariable variable=diagnosticSentinel;]unexpected';
    const versions = [
        '1.0.0', '*', '1.*', '1.2.*',
        `1.0.0\n${marker}\ntail`,
        `1.0.0\r\n${marker}\r\ntail`,
        `1.0.0\r${marker}\rtail`,
        `1.0.0${marker}`,
        `${marker}1.0.0${marker}`,
        `1.0.0\t${marker}`
    ];

    function runScenario(overrides: object): void {
        const scenario = {
            feedType: 'internal',
            version: '1.0.0',
            packageName: 'test-package',
            feedId: 'test-feed',
            projectId: 'test-project',
            downloadDirectory: 'custom directory',
            exitCode: 0,
            ...overrides
        };
        const result = spawnSync(process.execPath,
            [path.join(__dirname, 'DownloadDiagnosticTestSetup.js'), JSON.stringify(scenario)],
            { encoding: 'utf8' });
        assert.ifError(result.error);
        assert.strictEqual(result.status, 0, result.stdout + result.stderr);
    }

    for (const feedType of ['internal', 'external']) {
        for (const [index, version] of versions.entries()) {
            for (const exitCode of [0, 1]) {
                it(`protects ${feedType} version diagnostic ${index} with tool exit ${exitCode}`, () => {
                    runScenario({ feedType, version, exitCode });
                });
            }
        }
        for (const field of ['packageName', 'feedId', 'projectId']) {
            it(`protects ${feedType} ${field} diagnostics without changing tool arguments`, () => {
                runScenario({ feedType, [field]: `value\n${marker}` });
            });
        }
        it(`preserves ${feedType} collection-scoped downloads`, () => {
            runScenario({ feedType, projectId: '' });
        });
    }
});
