import * as assert from 'assert';
import * as mockery from 'mockery';

describe('UsePythonVersion L0 Suite', function () {
    before(function () {
        mockery.enable({ warnOnUnregistered: false });
        mockery.registerSubstitute('vsts-task-lib/task', 'vsts-task-lib/mock-task');
        mockery.registerMock('vsts-task-tool-lib/tool', {});
        mockery.registerAllowables([]); // TODO
    });

    after(function () {
        mockery.disable();
    });

    it('rejects invalid version spec', function () {
        const uut = require('../usepythonversion');
        const parameters = {
            versionSpec: '.1',
            outputVariable: '',
            addToPath: true
        };

        return uut.usePythonVersion(parameters, uut.Platform.Windows)
            .catch((error: Error) => {
                assert.equal(error.message, 'loc_mock_InvalidVersionSpec .1')
            });
    });

    // it('finds exact version in cache', function () {
    //     const uut = require('../usepythonversion');
    //     mockTask.setAnswers({
            
    //     });
    //     // TODO
    // });

    // it('finds pattern-matched version in cache', function () {
    //     const uut = require('../usepythonversion');
    //     // TODO
    //     mockTask.setAnswers({
            
    //     });
    // });

    // it('rejects pattern-matched version not in cache', function () {
    //     const uut = require('../usepythonversion');
    //     // TODO
    //     mockTask.setAnswers({
            
    //     });
    // });

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
