import * as assert from 'assert';
import * as utils from '../src/utils/utilities';

describe('Manifest object name validation', function () {
    it('accepts ordinary names', () => {
        assert.strictEqual(utils.validateManifestObjectToken('my-app.v1', 'metadata.name'), 'my-app.v1');
    });

    it('converts numeric YAML names to strings', () => {
        assert.strictEqual(utils.validateManifestObjectToken(123, 'metadata.name'), '123');
        assert.strictEqual(utils.validateManifestObjectToken(1.2, 'metadata.name'), '1.2');
        assert.strictEqual(utils.validateManifestObjectToken(Number.MAX_SAFE_INTEGER + 1, 'metadata.name'), '9007199254740992');
    });

    it('rejects non-finite numeric names', () => {
        [NaN, Infinity, -Infinity].forEach(value => {
            assert.throws(() => utils.validateManifestObjectToken(value, 'metadata.name'));
        });
    });

    it('rejects names that could be parsed as kubectl options', () => {
        [
            'invalid name',
            '--invalid',
            '-n',
            -1,
            'a\tb',
            'a\nb',
            '',
            undefined,
            null,
            'a'.repeat(254)
        ].forEach((name: any) => {
            assert.throws(() => utils.validateManifestObjectToken(name, 'metadata.name'));
        });
    });

    it('restores the legacy behavior when KubernetesManifest.DisableManifestObjectNameValidation is enabled', () => {
        const flag = 'DISTRIBUTEDTASK_TASKS_KUBERNETESMANIFEST_DISABLEMANIFESTOBJECTNAMEVALIDATION';
        process.env[flag] = 'true';
        try {
            assert.strictEqual(utils.validateManifestObjectToken('invalid name', 'metadata.name'), 'invalid name');
        } finally {
            delete process.env[flag];
        }
    });
});
