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
            findLocalTool: () => 'Python/3.6.4'
        });

        const uut = require('../usepythonversion'); // TODO TypeScript 2.4: `await ... import` to get type information
        const parameters = {
            versionSpec: '3.6',
            outputVariable: 'Python',
            addToPath: false
        };

        assert.notEqual(process.env['PYTHON'], 'Python/3.6.4');

        await uut.usePythonVersion(parameters, uut.Platform.Windows);
        assert.equal(process.env['PYTHON'], 'Python/3.6.4');
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
            await uut.usePythonVersion(parameters, uut.Platform.Windows);
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

    // it('sets PATH correctly on Linux', function () {
    //     const uut = require('../usepythonversion');
    //     // TODO
    //     mockTask.setAnswers({
            
    //     });
    // });

    // it('sets PATH correctly on Windows', function () {
    //     const uut = require('../usepythonversion');
    //     // TODO
    //     mockTask.setAnswers({
            
    //     });
    //     // On Windows, must add the "Scripts" directory to PATH as well
    // });

    // it('does not set PATH when the option is not selected', function () {
    //     const uut = require('../usepythonversion');
    //     // TODO
    //     mockTask.setAnswers({
            
    //     });
    // });
});
