import * as assert from 'assert';
import { EOL } from 'os';
import * as mockery from 'mockery';

describe('UsePythonVersion L0 Suite', function () {
    before(function () {
        mockery.enable({
            useCleanCache: true,
            warnOnUnregistered: false
        });
    });

    after(function () {
        mockery.disable();
    });

    beforeEach(function () {
        mockery.registerSubstitute('vsts-task-lib/task', 'vsts-task-lib/mock-task');
    });

    afterEach(function () {
        mockery.deregisterAll();
        mockery.resetCache();
    })

    it('finds version in cache', async function () {
        mockery.registerMock('vsts-task-tool-lib/tool', {
            findLocalTool: () => '/Python/3.6.4'
        });

        const uut = require('../usepythonversion');
        const parameters = {
            versionSpec: '3.6',
            outputVariable: 'Python',
            addToPath: false
        };

        assert.notEqual(process.env['PYTHON'], '/Python/3.6.4');

        await uut.usePythonVersion(parameters, uut.Platform.Linux);
        assert.equal(process.env['PYTHON'], '/Python/3.6.4');
    });

    it('rejects version not in cache', async function (done: MochaDone) {
        mockery.registerMock('vsts-task-tool-lib/tool', {
            findLocalTool: () => null,
            findLocalToolVersions: () => ['2.7.13']
        });

        const uut = require('../usepythonversion');
        const parameters = {
            versionSpec: '3.x',
            outputVariable: 'Python',
            addToPath: false
        };

        try {
            await uut.usePythonVersion(parameters, uut.Platform.Linux);
            done(new Error('should not have succeeded'));
        } catch (e) {
            const expectedMessage = [
                'loc_mock_VersionNotFound 3.x',
                'loc_mock_ListAvailableVersions',
                '2.7.13'
            ].join(EOL);

            assert.equal(e.message, expectedMessage);
            done();
        }
    });

    it('sets PATH correctly on Linux', async function () {
        mockery.registerMock('vsts-task-tool-lib/tool', {
            findLocalTool: () => '/Python/3.6.4'
        });

        const uut = require('../usepythonversion');
        const parameters = {
            versionSpec: '3.6',
            outputVariable: 'Python',
            addToPath: true
        };

        const pathBefore = process.env['PATH'];
        await uut.usePythonVersion(parameters, uut.Platform.Linux);
        assert.equal(process.env['PATH'], `/Python/3.6.4:${pathBefore}`);
    });

    it('sets PATH correctly on Windows', async function () {
        mockery.registerMock('vsts-task-tool-lib/tool', {
            findLocalTool: () => 'C:\\Python\\3.6.4'
        });

        const uut = require('../usepythonversion');
        const parameters = {
            versionSpec: '3.6',
            outputVariable: 'Python',
            addToPath: true
        };

        const pathBefore = process.env['PATH'];
        await uut.usePythonVersion(parameters, uut.Platform.Windows);
        // On Windows, must add the "Scripts" directory to PATH as well
        assert.equal(process.env['PATH'], `C:\\Python\\3.6.4\\Scripts;C:\\Python\\3.6.4;${pathBefore}`); 
    });
});
