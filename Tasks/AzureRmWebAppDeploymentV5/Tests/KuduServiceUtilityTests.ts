import * as assert from 'assert';
import * as path from 'path';
import { spawnSync } from 'child_process';

describe('Kudu package path diagnostics', () => {
    const cases = [
        ['ordinary paths', '/tmp/site.zip', '/site/wwwroot', '/tmp/site.zip', '/site/wwwroot'],
        ['Windows paths', 'C:\\drop\\my site%20.zip', 'D:\\home\\site\\wwwroot', 'C:\\drop\\my site%20.zip', 'D:\\home\\site\\wwwroot'],
        ['inline package marker', '/tmp/site##vso[task.debug]note.zip', '/site/wwwroot', '/tmp/site##_vso[task.debug]note.zip', '/site/wwwroot'],
        ['inline destination marker', '/tmp/site.zip', '/site/wwwroot##vso[task.debug]note', '/tmp/site.zip', '/site/wwwroot##_vso[task.debug]note'],
        ['extra hashes', '/tmp/site####vso[task.debug]note.zip', '/site/wwwroot', '/tmp/site####_vso[task.debug]note.zip', '/site/wwwroot'],
        ['case-sensitive marker', '/tmp/site##VsO[task.debug]note.zip', '/site/wwwroot', '/tmp/site##VsO[task.debug]note.zip', '/site/wwwroot'],
        ['formatting markers', '/tmp/site####[section]note.zip', '/site/wwwroot##[warning]note', '/tmp/site####[section]note.zip', '/site/wwwroot##[warning]note'],
        ['line breaks', '/tmp/site\r\n\n##vso[task.debug]note.zip', '/site/wwwroot\rnote', '/tmp/site\r\n\n##_vso[task.debug]note.zip', '/site/wwwroot\rnote'],
        ['split marker and literal escapes', '/tmp/site##\nvso[task.debug]%0A%AZP25.zip', '/site/wwwroot', '/tmp/site##\nvso[task.debug]%0A%AZP25.zip', '/site/wwwroot']
    ];

    for (const flag of ['unset', 'false', 'true']) {
        for (const [name, packagePath, physicalPath, blockedPackagePath, blockedPhysicalPath] of cases) {
            it(`logs ${name} with disable flag ${flag} without changing deployment arguments`, () => {
                const displayedPackagePath = flag === 'true' ? packagePath : blockedPackagePath;
                const displayedPhysicalPath = flag === 'true' ? physicalPath : blockedPhysicalPath;
                const result = spawnSync(process.execPath, [
                    path.join(__dirname, 'KuduServiceUtilityL0Tests.js'),
                    packagePath, physicalPath, displayedPackagePath, displayedPhysicalPath, flag
                ], { encoding: 'utf8' });

                assert.ifError(result.error);
                assert.strictEqual(result.status, 0, result.stderr);
                // The fixture checks captured diagnostics separately from task-lib's own debug output.
                const lines = result.stdout.trim().split(/\r?\n/)
                    .filter(line => !line.startsWith('##vso[task.debug]'));
                assert.strictEqual(lines.pop(), 'Deployment arguments preserved');
                const markers = (packagePath + physicalPath).match(/##vso\[/g) || [];
                assert.strictEqual(lines.length, markers.length, result.stdout);
                for (const line of lines) {
                    assert.ok(line.startsWith('##vso[telemetry.publish '), line);
                    const event = JSON.parse(line.substring(line.indexOf(']') + 1));
                    assert.strictEqual(event.source, 'repository');
                    assert.strictEqual(event.commandName, 'task.debug');
                    assert.strictEqual(event.blocked, flag !== 'true');
                    assert.strictEqual(event.data, undefined);
                }
            });
        }
    }
});
