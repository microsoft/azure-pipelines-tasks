import * as assert from 'assert';
import * as utils from '../src/utils/utilities';

describe('Manifest object name validation', function () {
    it('accepts ordinary names', () => {
        assert.strictEqual(utils.validateManifestObjectToken('my-app.v1', 'metadata.name'), 'my-app.v1');
    });

    it('rejects names that could be parsed as kubectl options', () => {
        [
            'invalid name',
            '--invalid',
            '-n',
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
