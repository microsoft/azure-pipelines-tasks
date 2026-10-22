import * as assert from 'assert';
import * as path from 'path';
import { spawnSync } from 'child_process';

describe('Kudu package path diagnostics', () => {
    const cases = [
        ['ordinary paths', '/tmp/site.zip', '/site/wwwroot', '/tmp/site.zip', '/site/wwwroot'],
        ['Windows paths', 'C:\\drop\\my site%20.zip', 'D:\\home\\site\\wwwroot', 'C:\\drop\\my site%20.zip', 'D:\\home\\site\\wwwroot'],
        ['inline package marker', '/tmp/site##vso[task.debug]note.zip', '/site/wwwroot', '/tmp/site#vso[task.debug]note.zip', '/site/wwwroot'],
        ['inline destination marker', '/tmp/site.zip', '/site/wwwroot##vso[task.debug]note', '/tmp/site.zip', '/site/wwwroot#vso[task.debug]note'],
        ['mixed case and extra hashes', '/tmp/site####VsO[task.debug]note.zip', '/site/wwwroot', '/tmp/site#vso[task.debug]note.zip', '/site/wwwroot'],
        ['formatting markers', '/tmp/site####[section]note.zip', '/site/wwwroot##[warning]note', '/tmp/site#[section]note.zip', '/site/wwwroot#[warning]note'],
        ['line breaks', '/tmp/site\r\n##vso[task.debug]note.zip', '/site/wwwroot\rnote', '/tmp/site #vso[task.debug]note.zip', '/site/wwwroot note'],
        ['split marker and literal escapes', '/tmp/site##\nvso[task.debug]%0A%AZP25.zip', '/site/wwwroot', '/tmp/site## vso[task.debug]%0A%AZP25.zip', '/site/wwwroot']
    ];

    for (const [name, packagePath, physicalPath, displayedPackagePath, displayedPhysicalPath] of cases) {
        it(`formats ${name} without changing deployment arguments`, () => {
            const result = spawnSync(process.execPath, [
                path.join(__dirname, 'KuduServiceUtilityL0Tests.js'),
                packagePath, physicalPath, displayedPackagePath, displayedPhysicalPath
            ], { encoding: 'utf8' });

            assert.ifError(result.error);
            assert.strictEqual(result.status, 0, result.stderr);
            assert.strictEqual(result.stdout.trim(),
                `Successfully deployed package ${displayedPackagePath} using kudu service at ${displayedPhysicalPath}\nDeployment arguments preserved`);
            // Check the parser's marker boundary anywhere on the line, not only at its start.
            assert.strictEqual(result.stdout.toLowerCase().indexOf('##vso['), -1);
            assert.strictEqual(result.stdout.indexOf('##['), -1);
        });
    }
});
