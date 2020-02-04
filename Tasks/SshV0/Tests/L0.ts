import assert = require('assert');
import tmrm = require('azure-pipelines-task-lib/mock-test');
import path = require('path');

function runValidations(validator: () => void, tr, done) {
    try {
        validator();
        done();
    }
    catch (error) {
        console.log("STDERR", tr.stderr);
        console.log("STDOUT", tr.stdout);
        done(error);
    }
}

describe('SshV0 Suite', function() {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    it('Fails for missing endpoint', (done) => {
        delete process.env['sshEndpoint'];
        delete process.env['commands'];
        delete process.env['runOptions'];
        process.env['readyTimeout'] = '20000';

        let tp = path.join(__dirname, 'L0SshRunner.js');
        var tr = new tmrm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.invokedToolCount == 0, 'should not have run any tools');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('Input required: sshEndpoint') >= 0, 'wrong error message: "' + tr.stdout + '"');
        }, tr, done);
    });

    it('Fails when user name is not provided in the endpoint', (done) => {
        delete process.env['runOptions'];
        process.env['sshEndpoint'] = 'IDUserNameNotSet';
        process.env['commands'] = 'ls -l';
        process.env['readyTimeout'] = '20000';

        let tp = path.join(__dirname, 'L0SshRunner.js');
        var tr = new tmrm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.invokedToolCount == 0, 'should not have run any tools');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('Endpoint auth data not present: IDUserNameNotSet') >= 0, 'wrong error message: "' + tr.stdout + '"');
        }, tr, done);
    });

    it('Empty password/passphrase is valid in the endpoint', (done) => {
        delete process.env['commands'];
        delete process.env['runOptions'];
        process.env['sshEndpoint'] = 'IDPasswordNotSet';
        process.env['readyTimeout'] = '20000';

        let tp = path.join(__dirname, 'L0SshRunner.js');
        var tr = new tmrm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.invokedToolCount == 0, 'should not have run any tools');
            assert(tr.stderr.indexOf('Input required: password') < 0, 'task should not require password');
        }, tr, done);
    });

    it('Fails when host is not provided in the endpoint', (done) => {
        delete process.env['commands'];
        delete process.env['runOptions'];
        process.env['sshEndpoint'] = 'IDHostNotSet';
        process.env['readyTimeout'] = '20000';

        let tp = path.join(__dirname, 'L0SshRunner.js');
        var tr = new tmrm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.invokedToolCount == 0, 'should not have run any tools');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('Endpoint auth data not present: IDHostNotSet') >= 0, 'wrong error message: "' + tr.stdout + '"');
        }, tr, done);
    });

    it('When port is not provided in the endpoint, 22 is used as default port number', (done) => {
        delete process.env['commands'];
        delete process.env['runOptions'];
        process.env['sshEndpoint'] = 'IDPortNotSet';
        process.env['readyTimeout'] = '20000';

        let tp = path.join(__dirname, 'L0SshRunner.js');
        var tr = new tmrm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.invokedToolCount == 0, 'should not have run any tools');
            assert(tr.stdout.indexOf('loc_mock_UseDefaultPort') >= 0, 'default port 22 was not used');
        }, tr, done);
    });

    it('Fails when connection cannot be made with given details', (done) => {
        process.env['sshEndpoint'] = 'IDValidKey';
        process.env['commands'] = 'ls -l';
        process.env['runOptions'] = 'commands';
        process.env['readyTimeout'] = '20000';

        let tp = path.join(__dirname, 'L0SshRunner.js');
        var tr = new tmrm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.invokedToolCount == 0, 'should not have run any tools');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('loc_mock_ConnectionFailed Error: Cannot parse privateKey: Malformed OpenSSH private key. Bad passphrase?') >= 0, 'wrong error message: "' + tr.stdout + '"');
        }, tr, done);
    });

    it('Fails for missing run options', (done) => {
        delete process.env['commands'];
        delete process.env['runOptions'];
        process.env['sshEndpoint'] = 'IDValidKey';
        process.env['readyTimeout'] = '20000';

        let tp = path.join(__dirname, 'L0SshRunner.js');
        var tr = new tmrm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.invokedToolCount == 0, 'should not have run any tools');
            assert(tr.failed, 'build should have failed');
            assert(tr.stdout.indexOf('Input required: runOptions') >= 0, 'wrong error message: "' + tr.stdout + '"');
        }, tr, done);
    });

    it('Fails for missing commands', (done) => {
        delete process.env['commands'];
        process.env['sshEndpoint'] = 'IDValidKey';
        process.env['runOptions'] = 'commands';
        process.env['readyTimeout'] = '20000';

        let tp = path.join(__dirname, 'L0SshRunner.js');
        var tr = new tmrm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.invokedToolCount == 0, 'should not have run any tools');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('Input required: commands') >= 0, 'wrong error message: "' + tr.stdout + '"');
        }, tr, done);
    });

    it('Fails for missing script path', (done) => {
        delete process.env['commands'];
        process.env['sshEndpoint'] = 'IDValidKey';
        process.env['runOptions'] = 'script';
        process.env['readyTimeout'] = '20000';

        let tp = path.join(__dirname, 'L0SshRunner.js');
        var tr = new tmrm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.invokedToolCount == 0, 'should not have run any tools');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('Input required: scriptPath') >= 0, 'wrong error message: "' + tr.stdout + '"');
        }, tr, done);
    });

    it('Fails for missing readyTimeout', (done) => {
        process.env['commands'] = 'ls -l';
        process.env['sshEndpoint'] = 'IDValidKey';
        process.env['readyTimeout'] = '20000';
        process.env['runOptions'] = 'commands';
        delete process.env['readyTimeout'];

        let tp = path.join(__dirname, 'L0SshRunner.js');
        var tr = new tmrm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.invokedToolCount == 0, 'should not have run any tools');
            assert(tr.failed, 'task should have failed');
            assert(tr.stdout.indexOf('Input required: readyTimeout') >= 0, 'wrong error message: "' + tr.stdout + '"');
        }, tr, done);
    });
});