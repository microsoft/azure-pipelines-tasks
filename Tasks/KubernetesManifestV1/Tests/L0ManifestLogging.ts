import * as assert from 'assert';
import * as fs from 'fs';
import * as tl from 'azure-pipelines-task-lib/task';
import * as mocker from 'azure-pipelines-task-lib/lib-mocker';

describe('Manifest logging safety', function () {
    const marker = 'synthetic-manifest-password';
    const encoded = Buffer.from(marker).toString('base64');
    const resource = { apiVersion: 'v1', kind: 'Secret', metadata: { name: 'test-secret' }, data: { password: encoded }, stringData: { password: marker } };
    const manifest = JSON.stringify(resource);
    let diagnostics: string[];
    let writes: string[];
    let failWrite: boolean;
    let renderType: string;
    let manifestContents: string;

    beforeEach(() => {
        diagnostics = [];
        writes = [];
        failWrite = false;
        manifestContents = manifest;
        mocker.enable({ useCleanCache: true, warnOnUnregistered: false });
        mocker.registerMock('fs', Object.assign({}, fs, {
            readFileSync: (filePath, options) => filePath === 'manifest.yaml' ? Buffer.from(manifestContents) : fs.readFileSync(filePath, options),
            writeFileSync: (_filePath: string, content: string) => {
                if (failWrite) {
                    throw Object.assign(new Error("ENOSPC: no space left on device, open 'probe-file'"), { code: 'ENOSPC', path: 'probe-file' });
                }
                writes.push(content);
            }
        }));
        mocker.registerMock('azure-pipelines-task-lib/task', Object.assign({}, tl, {
            debug: (message: string) => diagnostics.push(message),
            getVariable: (name: string) => name === 'System.HostType' ? 'build' : undefined,
            getInput: (name: string) => name === 'renderType' ? renderType : 'test-release',
            getPathInput: () => 'test-path',
            getDelimitedInput: () => [],
            setVariable: () => undefined,
            tool: () => {
                let args: string[];
                return {
                    arg: (value: string[]) => { args = value; },
                    execSync: () => ({
                        code: 0, stderr: '',
                        stdout: args[0] === 'version' ? '{"clientVersion":{"major":"1","minor":"14"}}' : manifest
                    })
                };
            }
        }));
        mocker.registerMock('../models/TaskInputParameters', { containers: [], namespace: '' });
        mocker.registerMock('../utils/utilities', { getKubectl: async () => 'kubectl', validateReleaseName: value => value });
        mocker.registerMock('azure-pipelines-tasks-kubernetes-common/helmutility', { getHelm: async () => 'helm' });
        mocker.registerMock('azure-pipelines-tasks-kubernetes-common/helm-object-model', {
            Helm: class {
                public template() { return { code: 0, stderr: '', stdout: manifest }; }
            }
        });
    });

    afterEach(() => {
        mocker.disable();
        mocker.deregisterAll();
    });

    function assertSafeDiagnostics() {
        assert(diagnostics.length > 0, 'useful diagnostics should remain');
        const output = diagnostics.join('\n');
        [marker, encoded, resource.metadata.name, manifest].forEach(value => assert(output.indexOf(value) === -1));
    }

    it('retains a resource count without changing or logging Secret content', async () => {
        const helper = await import('../src/utils/DeploymentHelper');
        assert.strictEqual(helper.updateResourceObjects(['manifest.yaml'], [], []).length, 1);
        assert.deepStrictEqual(writes.map(value => JSON.parse(value)), [resource]);
        assert(diagnostics.some(value => value.indexOf('Prepared 1 Kubernetes resource objects') === 0));
        assertSafeDiagnostics();
    });

    it('rejects a mixed manifest containing a cyclic resource before writing any resources', async () => {
        manifestContents = [
            manifest,
            '---',
            'apiVersion: v1',
            'kind: ConfigMap',
            'metadata:',
            '  name: cyclic-resource',
            'data: &loop',
            '  again: *loop'
        ].join('\n');
        const helper = await import('../src/utils/DeploymentHelper');
        assert.throws(() => helper.updateResourceObjects(['manifest.yaml'], [], []), TypeError);
        assert.deepStrictEqual(writes, []);
        assert.deepStrictEqual(diagnostics, []);
    });

    it('omits invalid resources and manifest content while retaining filesystem errors', async () => {
        const helper = await import('../src/utils/FileHelper');
        assert.deepStrictEqual(helper.writeObjectsToFile([{ kind: 'Secret', stringData: { password: marker } }]), []);
        assert(helper.writeManifestToFile(manifest, 'Secret', resource.metadata.name).length > 0);
        assert.deepStrictEqual(writes, [manifest]);
        failWrite = true;
        assert.strictEqual(helper.writeManifestToFile(manifest, 'Secret', resource.metadata.name), '');
        assert(diagnostics.some(value => value === "Exception occurred while writing manifest to file. Exception: Error: ENOSPC: no space left on device, open 'probe-file'"));
        assertSafeDiagnostics();
    });

    it('preserves the original object-write exception diagnostic with filesystem details', async () => {
        const error = new Error("ENAMETOOLONG: name too long, open 'probe-file'");
        mocker.registerMock('fs', Object.assign({}, fs, {
            writeFileSync: () => { throw error; }
        }));
        const helper = await import('../src/utils/FileHelper');
        assert.deepStrictEqual(helper.writeObjectsToFile([resource]), []);
        assert.deepStrictEqual(diagnostics, [
            'Exception occurred while writing object to file : [object Object] . Exception: ' + error
        ]);
        assert(diagnostics[0].indexOf(marker) === -1);
        assert(diagnostics[0].indexOf(encoded) === -1);
    });

    ['helm', 'helm2', 'kustomize'].forEach(engine => {
        it(`retains ${engine} completion diagnostics and preserves rendered content`, async () => {
            renderType = engine;
            const action = await import('../src/actions/bake');
            await action.bake();
            assert.deepStrictEqual(writes, [manifest]);
            assert(diagnostics.some(value => value.indexOf('rendering completed; generated manifest file written.') >= 0));
            assertSafeDiagnostics();
        });
    });
});
