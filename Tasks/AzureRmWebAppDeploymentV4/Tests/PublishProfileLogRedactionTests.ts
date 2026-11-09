import * as assert from 'assert';
import * as path from 'path';
import { spawnSync } from 'child_process';

describe('Publish profile log redaction', function() {
    this.timeout(30000);

    const cases = [
        ['true', 'redacts nested secrets and preserves the full deployment profile'],
        ['false', 'preserves legacy logging when the feature is disabled'],
        ['unset', 'preserves legacy logging when the feature is unset'],
        ['no-database', 'reports profiles without nested database settings'],
        ['telemetry-failure', 'preserves the profile when telemetry fails']
    ];

    for (const [mode, description] of cases) {
        it(description, () => {
            const result = spawnSync(process.execPath, [
                path.join(__dirname, 'PublishProfileLogRedactionL0Tests.js'), mode
            ], { encoding: 'utf8', timeout: 20000 });

            assert.ifError(result.error);
            assert.strictEqual(result.status, 0, result.stdout + result.stderr);
        });
    }
});
