import * as assert from 'assert';
import * as path from 'path';
import { spawnSync } from 'child_process';

describe('UniversalPackages V1 informational diagnostics', function () {
    this.timeout(10000);
    const marker = '##vso[task.setvariable variable=diagnosticSentinel;]unexpected';
    const versions = [
        '1.0.0',
        `1.0.0\n${marker}\ntail`,
        `1.0.0\r\n${marker}\r\ntail`,
        `1.0.0\r${marker}\rtail`,
        `1.0.0${marker}`,
        `${marker}1.0.0${marker}`,
        `1.0.0\t${marker}`
    ];

    function runScenario(overrides: object): void {
        const scenario = {
            command: 'publish',
            version: '1.0.0',
            packageName: 'test-package',
            feedName: 'test-feed',
            projectName: 'test-project',
            directory: 'custom directory',
            exitCode: 0,
            ...overrides
        };
        const result = spawnSync(process.execPath,
            [path.join(__dirname, 'InfoDiagnosticTestSetup.js'), JSON.stringify(scenario)],
            { encoding: 'utf8' });
        assert.ifError(result.error);
        assert.strictEqual(result.status, 0, result.stdout + result.stderr);
    }

    for (const command of ['publish', 'download']) {
        for (const [index, version] of versions.entries()) {
            for (const exitCode of [0, 1]) {
                it(`protects ${command} version diagnostic ${index} with tool exit ${exitCode}`, () => {
                    runScenario({ command, version, exitCode });
                });
            }
        }
        for (const field of ['packageName', 'feedName', 'directory']) {
            it(`protects ${command} ${field} diagnostics without changing arguments`, () => {
                runScenario({ command, [field]: `value\n${marker}` });
            });
        }
        it(`preserves organization-scoped ${command}`, () => {
            runScenario({ command, projectName: '' });
        });
    }
    for (const version of ['*', '1.*', '1.2.*']) {
        it(`preserves download selector ${version}`, () => runScenario({ command: 'download', version }));
    }
    for (const versionIncrement of ['major', 'minor', 'patch']) {
        it(`protects ${versionIncrement} increment diagnostics`, () => {
            runScenario({ version: '', versionIncrement });
        });
    }
});
