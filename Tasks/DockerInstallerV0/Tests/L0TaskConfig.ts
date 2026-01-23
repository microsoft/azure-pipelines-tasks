import fs = require('fs');
import assert = require('assert');
import path = require('path');

/**
 * Test suite for Docker Installer task configuration and inputs
 */
describe('DockerInstallerV0 Task Configuration Tests', function () {
    const taskJsonPath = path.join(__dirname, '..', 'task.json');
    let taskJson: any;

    before(() => {
        taskJson = JSON.parse(fs.readFileSync(taskJsonPath, 'utf8'));
    });

    after(() => {
    });

    describe('Task Metadata', () => {
        it('should have valid task ID (GUID format)', () => {
            assert(taskJson.id, 'task.json must have an id');
            const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            assert(guidRegex.test(taskJson.id), 'task id must be a valid GUID');
        });

        it('should have name as DockerInstaller', () => {
            assert.strictEqual(taskJson.name, 'DockerInstaller', 'task name must be DockerInstaller');
        });

        it('should have friendlyName defined', () => {
            assert(taskJson.friendlyName, 'task must have a friendlyName');
            assert(taskJson.friendlyName.toLowerCase().includes('docker'), 'friendlyName should mention docker');
        });

        it('should have description defined', () => {
            assert(taskJson.description, 'task must have a description');
        });

        it('should have category as Tool', () => {
            assert.strictEqual(taskJson.category, 'Tool', 'task category must be Tool');
        });

        it('should have Microsoft Corporation as author', () => {
            assert.strictEqual(taskJson.author, 'Microsoft Corporation', 'author must be Microsoft Corporation');
        });

        it('should have version with Major, Minor, and Patch', () => {
            assert(taskJson.version, 'task must have version');
            assert(typeof taskJson.version.Major === 'number', 'Major version must be a number');
            assert(typeof taskJson.version.Minor === 'number', 'Minor version must be a number');
            assert(typeof taskJson.version.Patch === 'number', 'Patch version must be a number');
        });
    });

    describe('Task Inputs', () => {
        it('should have dockerVersion input', () => {
            const input = taskJson.inputs.find((i: any) => i.name === 'dockerVersion');
            assert(input, 'dockerVersion input must exist');
            assert.strictEqual(input.type, 'string', 'dockerVersion must be a string type');
            assert(input.required, 'dockerVersion must be required');
            assert(input.defaultValue, 'dockerVersion must have a default value');
        });

        it('should have releaseType input with valid options', () => {
            const input = taskJson.inputs.find((i: any) => i.name === 'releaseType');
            assert(input, 'releaseType input must exist');
            assert.strictEqual(input.type, 'pickList', 'releaseType must be a pickList type');
            assert(input.options, 'releaseType must have options');
            
            const expectedOptions = ['stable', 'edge', 'test', 'nightly'];
            for (const option of expectedOptions) {
                assert(input.options[option], `releaseType must have '${option}' option`);
            }
        });

        it('should have stable as default releaseType', () => {
            const input = taskJson.inputs.find((i: any) => i.name === 'releaseType');
            assert.strictEqual(input.defaultValue, 'stable', 'releaseType default should be stable');
        });
    });

    describe('Task Demands and Satisfies', () => {
        it('should have empty demands array', () => {
            assert(Array.isArray(taskJson.demands), 'demands must be an array');
            assert.strictEqual(taskJson.demands.length, 0, 'demands array should be empty');
        });

        it('should satisfy Docker capability', () => {
            assert(Array.isArray(taskJson.satisfies), 'satisfies must be an array');
            assert(taskJson.satisfies.includes('Docker'), 'task must satisfy Docker capability');
        });
    });

    describe('Task Visibility', () => {
        it('should be visible in Build and Release', () => {
            assert(Array.isArray(taskJson.visibility), 'visibility must be an array');
            assert(taskJson.visibility.includes('Build'), 'task must be visible in Build');
            assert(taskJson.visibility.includes('Release'), 'task must be visible in Release');
        });
    });

    describe('Task Messages', () => {
        it('should have required localization messages', () => {
            assert(taskJson.messages, 'task must have messages');
            assert(taskJson.messages.DockerDownloadFailed, 'must have DockerDownloadFailed message');
            assert(taskJson.messages.DockerNotFoundInFolder, 'must have DockerNotFoundInFolder message');
            assert(taskJson.messages.VerifyDockerInstallation, 'must have VerifyDockerInstallation message');
        });
    });
});
