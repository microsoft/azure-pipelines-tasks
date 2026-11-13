import * as assert from 'assert';
import * as path from 'path';
import * as utils from '../src/utils/utilities';
import * as canaryDeploymentHelper from '../src/utils/CanaryDeploymentHelper';

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

    it('cleans up canary resources for manifests with unquoted numeric names', () => {
        const getResourceCalls = [];
        let deleteArgs = '';
        const kubectl = {
            getResource: (kind: string, name: string) => {
                getResourceCalls.push(`${kind}/${name}`);
                return { code: 1, stderr: 'not found' };
            },
            delete: (args: string) => {
                deleteArgs = args;
                return { code: 0, stdout: 'deleted' };
            }
        } as any;

        canaryDeploymentHelper.deleteCanaryDeployment(
            kubectl,
            [path.join(__dirname, 'manifests', 'numeric-name.yaml')],
            false
        );

        assert.deepStrictEqual(getResourceCalls, [
            'Deployment/123-baseline',
            'Deployment/1.2-baseline',
            'Deployment/9007199254740992-baseline',
            'Deployment/1.20-baseline'
        ]);
        assert.strictEqual(deleteArgs, 'Deployment 123-canary 1.2-canary 9007199254740992-canary 1.20-canary');
    });
});
