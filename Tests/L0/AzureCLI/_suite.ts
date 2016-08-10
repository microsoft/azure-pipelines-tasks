/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import assert = require('assert');
import trm = require('../../lib/taskRunner');
import path = require('path');

function setResponseFile(name: string) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('AzureCLI Suite', function () {
    this.timeout(20000);

    before((done) => {
        done();
    });

   after(function () {
    });

    it('successfully login azure classic and run bash script', (done) => {
        setResponseFile('azureclitaskPass.json');

        var tr = new trm.TaskRunner('AzureCLI');
        tr.setInput('connectedServiceNameSelector', 'connectedServiceName');
        tr.setInput('connectedServiceName', 'AzureClassic');
        tr.setInput('scriptPath', 'script.sh');
        tr.setInput('args', 'arg1');
        tr.setInput('cwd', 'fake/wd');
        tr.run()
            .then(() => {
                assert(tr.ran('/usr/local/bin/azure account clear -s sName'), 'it should have logged out of azure');
                assert(tr.ran('/usr/local/bin/azure config mode asm'), 'it should have set the mode to asm');
                assert(tr.invokedToolCount == 5, 'should have only run ShellScript');
                assert(tr.stderr.length == 0, 'should have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })
    it('successfully login azure RM and run bash script', (done) => {
        setResponseFile('azureclitaskPass.json');

        var tr = new trm.TaskRunner('AzureCLI');
        tr.setInput('connectedServiceNameSelector', 'ConnectedServiceNameARM');
        tr.setInput('connectedServiceNameARM', 'AzureRM');
        tr.setInput('scriptPath', 'script.sh');
        tr.setInput('args', 'arg1');
        tr.setInput('cwd', 'fake/wd');
        tr.setInput('failOnStandardError', 'false');
        tr.run()
            .then(() => {
                assert(tr.ran('/usr/local/bin/azure account clear -s sName'), 'it should have logged out of azure');
                assert(tr.ran('/usr/local/bin/azure config mode arm'), 'it should have set the mode to asm');
                assert(tr.invokedToolCount == 5, 'should have only run ShellScript');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })
    it('should fail when endpoint is not correct',(done) => {
        setResponseFile('azureLoginFails.json');

        var tr = new trm.TaskRunner('AzureCLI');
        tr.setInput('connectedServiceNameSelector', 'ConnectedServiceNameARM');
        tr.setInput('connectedServiceNameARM', 'InvalidEndpoint');
        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should have only run ShellScript');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })
    it('should not logout and not run bash when login failed AzureRM',(done) => {
        setResponseFile('azureLoginFails.json');

        var tr = new trm.TaskRunner('AzureCLI');
        tr.setInput('connectedServiceNameSelector', 'ConnectedServiceNameARM');
        tr.setInput('connectedServiceNameARM', 'AzureRMFail');
        tr.setInput('scriptPath', 'script.sh');
        tr.setInput('args', 'arg1');
        tr.setInput('cwd', 'fake/wd');
        tr.setInput('failOnStandardError', 'false');
        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 2, 'should have only run 2 azure invocations');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })
    it('should not logout and not run bash when login failed Classic',(done) => {
        setResponseFile('azureLoginFails.json');

        var tr = new trm.TaskRunner('AzureCLI');
        tr.setInput('connectedServiceNameSelector', 'ConnectedServiceName');
        tr.setInput('connectedServiceName', 'AzureClassicFail');
        tr.setInput('scriptPath', 'script.sh');
        tr.setInput('args', 'arg1');
        tr.setInput('cwd', 'fake/wd');
        tr.setInput('failOnStandardError', 'false');
        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 2, 'should have only run 2 azure invocations');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })
    it('should logout and fail without running bash when subscription not set',(done) => {
        setResponseFile('azureLoginFails.json');

        var tr = new trm.TaskRunner('AzureCLI');
        tr.setInput('connectedServiceNameSelector', 'ConnectedServiceNameARM');
        tr.setInput('connectedServiceNameARM', 'AzureRM');
        tr.setInput('scriptPath', 'script.sh');
        tr.setInput('args', 'arg1');
        tr.setInput('cwd', 'fake/wd');
        tr.setInput('failOnStandardError', 'false');
        tr.run()
            .then(() => {
                assert(tr.ran('/usr/local/bin/azure account clear -s sName'), 'it should have logged out of azure');
                assert(tr.invokedToolCount == 4, 'should have only run ShellScript');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })
    it('should logout of AzureRM if bash failed',(done) => {
        setResponseFile('bashFailed.json');

        var tr = new trm.TaskRunner('AzureCLI');
        tr.setInput('connectedServiceNameSelector', 'ConnectedServiceNameARM');
        tr.setInput('connectedServiceNameARM', 'AzureRM');
        tr.setInput('scriptPath', 'scriptfail.sh');
        tr.setInput('args', 'arg1');
        tr.setInput('cwd', 'fake/wd');
        tr.setInput('failOnStandardError', 'false');
        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 5, 'logout happened when bash fails');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })
    it('should logout of AzureClassic if bash failed',(done) => {
        setResponseFile('bashFailed.json');

        var tr = new trm.TaskRunner('AzureCLI');
        tr.setInput('connectedServiceNameSelector', 'ConnectedServiceName');
        tr.setInput('connectedServiceName', 'AzureClassic');
        tr.setInput('scriptPath', 'scriptfail.sh');
        tr.setInput('args', 'arg1');
        tr.setInput('cwd', 'fake/wd');
        tr.setInput('failOnStandardError', 'false');
        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 5, 'logout happened when bash fails');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })
    it('task should fail if bash not found',(done) => {
        setResponseFile('bashnotfoundFails.json');

        var tr = new trm.TaskRunner('AzureCLI');
        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have invoked any tool');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })
    it('task should fail in case script path is invalid',(done) => {
        setResponseFile('checkpathFails.json');

        var tr = new trm.TaskRunner('AzureCLI');
        tr.setInput('scriptPath', 'scriptfail.sh');
        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'logout happened when script checkpath fails');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                done();
            })
            .fail((err) => {
                done(err);
            });

    })
});