/// <reference path="../../definitions/mocha.d.ts"/>
/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/Q.d.ts"/>

import assert = require('assert');
import trm = require('../../lib/taskRunner');
import path = require('path');
import os = require('os');
import fs = require('fs');

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

    function addSubscriptionObjectJson(responseFileName:string, nameOfFileToBeCreated:string)
    {
        var jsonFileObject:any = JSON.parse(fs.readFileSync(path.join(__dirname,responseFileName)).toString());
        if( !jsonFileObject.exec['/usr/local/bin/azure account import ' + nameOfFileToBeCreated]){
            jsonFileObject.exec['/usr/local/bin/azure account import ' + nameOfFileToBeCreated] = jsonFileObject.exec['/usr/local/bin/azure account import subscriptions.publishsettings'];
        }
        fs.writeFileSync(path.join(__dirname,responseFileName), JSON.stringify(jsonFileObject));
    }

    function addInlineObjectJson(responseFileName:string, nameOfFileToBeCreated:string)
    {
        var jsonFileObject:any = JSON.parse(fs.readFileSync(path.join(__dirname,responseFileName)).toString());
        if(os.type() == "Windows_NT")
        {
            if( !jsonFileObject.exec[nameOfFileToBeCreated]){
                jsonFileObject.exec[nameOfFileToBeCreated] = jsonFileObject.exec['script.bat arg1'];
            }
            if(!jsonFileObject.which[nameOfFileToBeCreated]) {
                jsonFileObject.which[nameOfFileToBeCreated] = nameOfFileToBeCreated;
            }
            if(!jsonFileObject.checkPath[nameOfFileToBeCreated]) {
                jsonFileObject.checkPath[nameOfFileToBeCreated] = true;
            }
        }
        else
        {
            if( !jsonFileObject.checkPath[nameOfFileToBeCreated]){
                jsonFileObject.checkPath[nameOfFileToBeCreated] = true;
            }
            if( !jsonFileObject.exec[nameOfFileToBeCreated]){
                jsonFileObject.exec[nameOfFileToBeCreated] = jsonFileObject.exec['script.bat arg1'];
            }
        }
        fs.writeFileSync(path.join(__dirname,responseFileName), JSON.stringify(jsonFileObject));
    }

    function deleteInlineObjectJson(responseFileName:string, nameOfFileToBeCreated:string)
    {
        var jsonFileObject:any = JSON.parse(fs.readFileSync(path.join(__dirname,responseFileName)).toString());
        if(os.type() === "Windows_NT")
        {
            delete jsonFileObject.exec[nameOfFileToBeCreated];
            delete jsonFileObject.which[nameOfFileToBeCreated];
            delete jsonFileObject.checkPath[nameOfFileToBeCreated];
        }
        else
        {
            delete jsonFileObject.exec[nameOfFileToBeCreated];
            delete jsonFileObject.checkPath[nameOfFileToBeCreated];
        }

        fs.writeFileSync(path.join(__dirname,responseFileName), JSON.stringify(jsonFileObject));
    }

    function deleteSubscriptionObjectJson(responseFileName:string, nameOfFileToBeCreated:string)
    {
        var jsonFileObject:any = JSON.parse(fs.readFileSync(path.join(__dirname,responseFileName)).toString());
        delete jsonFileObject.exec['/usr/local/bin/azure account import ' + nameOfFileToBeCreated];
        fs.writeFileSync(path.join(__dirname,responseFileName), JSON.stringify(jsonFileObject));
    }

    var publishsettingFileName:string = '.*subscriptions.*';
    var inlineScriptName:string = '.*azureclitaskscript.*';

    it('successfully login azure classic and run shell script (scriptPath)', (done) => {
        var responseFileName:string = 'azureclitaskPass.json';
        addSubscriptionObjectJson(responseFileName, publishsettingFileName);
        setResponseFile(responseFileName);

        var tr = new trm.TaskRunner('AzureCLI', false, false, true);
        tr.setInput('scriptLocation', 'scriptPath');
        tr.setInput('scriptPath', 'script.sh');
        tr.setInput('cwd', 'fake/wd');
        tr.setInput('args', 'arg1');
        tr.setInput('failOnStandardError', 'false');
        tr.setInput('connectedServiceNameSelector', 'connectedServiceName');
        tr.setInput('connectedServiceName', 'AzureClassic');
        tr.run()
            .then(() => {
                deleteSubscriptionObjectJson(responseFileName, publishsettingFileName);
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
    it('successfully login azure classic and run batch script (scriptPath)', (done) => {
        var responseFileName:string = 'azureclitaskPass.json';
        addSubscriptionObjectJson(responseFileName, publishsettingFileName);
        setResponseFile(responseFileName);

        var tr = new trm.TaskRunner('AzureCLI', false, false, true);
        tr.setInput('scriptLocation', 'scriptPath');
        tr.setInput('scriptPath', 'script.bat');
        tr.setInput('cwd', 'fake/wd');
        tr.setInput('args', 'arg1');
        tr.setInput('failOnStandardError', 'false');
        tr.setInput('connectedServiceNameSelector', 'connectedServiceName');
        tr.setInput('connectedServiceName', 'AzureClassic');
        tr.run()
            .then(() => {
                deleteSubscriptionObjectJson(responseFileName, publishsettingFileName)
                assert(tr.ran('/usr/local/bin/azure account clear -s sName'), 'it should have logged out of azure');
                assert(tr.ran('/usr/local/bin/azure config mode asm'), 'it should have set the mode to asm');
                assert(tr.invokedToolCount == 5, 'should have only run Batch Script');
                assert(tr.stderr.length == 0, 'should have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })
    it('successfully login azure classic and run shell script (inline)', (done) => {
        var responseFileName:string = 'azureclitaskPass.json';
        addInlineObjectJson(responseFileName, inlineScriptName);
        addSubscriptionObjectJson(responseFileName, publishsettingFileName);
        setResponseFile(responseFileName);

        var tr = new trm.TaskRunner('AzureCLI', false, false, true);
        tr.setInput('scriptLocation', 'inlineScript');
        tr.setInput('inlineScript', 'console.log("test");');
        tr.setInput('cwd', 'fake/wd');
        tr.setInput('args', 'arg1');
        tr.setInput('failOnStandardError', 'false');
        tr.setInput('connectedServiceNameSelector', 'connectedServiceName');
        tr.setInput('connectedServiceName', 'AzureClassic');
        tr.run()
            .then(() => {
                deleteSubscriptionObjectJson(responseFileName, publishsettingFileName);
                deleteInlineObjectJson(responseFileName, inlineScriptName);
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
    it('successfully login azure classic and run batch script (inline)', (done) => {
        var responseFileName:string = 'azureclitaskPass.json';
        addInlineObjectJson(responseFileName, inlineScriptName);
        addSubscriptionObjectJson(responseFileName, publishsettingFileName);
        setResponseFile(responseFileName);

        var tr = new trm.TaskRunner('AzureCLI', false, false, true);
        tr.setInput('scriptLocation', 'inlineScript');
        tr.setInput('inlineScript', 'console.log("test");');
        tr.setInput('cwd', 'fake/wd');
        tr.setInput('args', 'arg1');
        tr.setInput('failOnStandardError', 'false');
        tr.setInput('connectedServiceNameSelector', 'connectedServiceName');
        tr.setInput('connectedServiceName', 'AzureClassic');
        tr.run()
            .then(() => {
                deleteSubscriptionObjectJson(responseFileName, publishsettingFileName);
                deleteInlineObjectJson(responseFileName, inlineScriptName);
                assert(tr.ran('/usr/local/bin/azure account clear -s sName'), 'it should have logged out of azure');
                assert(tr.ran('/usr/local/bin/azure config mode asm'), 'it should have set the mode to asm');
                assert(tr.invokedToolCount == 5, 'should have only run Batch Script');
                assert(tr.stderr.length == 0, 'should have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })
    it('successfully login azure RM and run shell script (scriptPath)', (done) => {
        setResponseFile('azureclitaskPass.json');

       var tr = new trm.TaskRunner('AzureCLI', false, false ,false);
        tr.setInput('scriptLocation', 'scriptPath');
        tr.setInput('scriptPath', 'script.sh');
        tr.setInput('cwd', 'fake/wd');
        tr.setInput('args', 'arg1');
        tr.setInput('failOnStandardError', 'false');
        tr.setInput('connectedServiceNameSelector', 'connectedServiceNameARM');
        tr.setInput('connectedServiceNameARM', 'AzureRM');
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
    it('successfully login azure RM and run shell script (inline)', (done) => {
        var responseFileName:string = 'azureclitaskPass.json';
        addInlineObjectJson(responseFileName, inlineScriptName);
        setResponseFile(responseFileName);

        var tr = new trm.TaskRunner('AzureCLI', false, false, true);
        tr.setInput('scriptLocation', 'inlineScript');
        tr.setInput('inlineScript', 'console.log("test");');
        tr.setInput('cwd', 'fake/wd');
        tr.setInput('args', 'arg1');
        tr.setInput('failOnStandardError', 'false');
        tr.setInput('connectedServiceNameSelector', 'connectedServiceNameARM');
        tr.setInput('connectedServiceNameARM', 'AzureRM');
        tr.run()
            .then(() => {
                deleteInlineObjectJson(responseFileName, inlineScriptName);
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
    it('should fail when endpoint is not correct (scriptPath)',(done) => {
        setResponseFile('azureLoginFails.json');

        var tr = new trm.TaskRunner('AzureCLI');
        tr.setInput('scriptLocation', 'scriptPath');
        tr.setInput('scriptPath', 'script.sh');
        tr.setInput('cwd', 'fake/wd');
        tr.setInput('args', 'arg1');
        tr.setInput('failOnStandardError', 'false');
        tr.setInput('connectedServiceNameSelector', 'connectedServiceNameARM');
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
    it('should not logout and not run bash when login failed AzureRM (scriptPath)',(done) => {
        setResponseFile('azureLoginFails.json');

        var tr = new trm.TaskRunner('AzureCLI');
        tr.setInput('scriptLocation', 'scriptPath');
        tr.setInput('scriptPath', 'script.sh');
        tr.setInput('cwd', 'fake/wd');
        tr.setInput('args', 'arg1');
        tr.setInput('failOnStandardError', 'false');
        tr.setInput('connectedServiceNameSelector', 'connectedServiceNameARM');
        tr.setInput('connectedServiceNameARM', 'AzureRMFail');
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
    it('should not logout and not run bash when login failed Classic (scriptPath)',(done) => {
        var responseFileName:string ='azureLoginFails.json';
        addSubscriptionObjectJson(responseFileName, publishsettingFileName)
        setResponseFile(responseFileName);

        var tr = new trm.TaskRunner('AzureCLI', false, false, true);
        tr.setInput('scriptLocation', 'scriptPath');
        tr.setInput('scriptPath', 'script.sh');
        tr.setInput('cwd', 'fake/wd');
        tr.setInput('args', 'arg1');
        tr.setInput('failOnStandardError', 'false');
        tr.setInput('connectedServiceNameSelector', 'connectedServiceName');
        tr.setInput('connectedServiceName', 'AzureClassicFail');
        tr.run()
            .then(() => {
                deleteSubscriptionObjectJson(responseFileName, publishsettingFileName)
                assert(tr.invokedToolCount == 2, 'should have only run 2 azure invocations');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })
    it('should logout and fail without running bash when subscription not set in AzureRM (scriptPath)',(done) => {
        setResponseFile('azureLoginFails.json');

        var tr = new trm.TaskRunner('AzureCLI');
        tr.setInput('scriptLocation', 'scriptPath');
        tr.setInput('scriptPath', 'script.sh');
        tr.setInput('cwd', 'fake/wd');
        tr.setInput('args', 'arg1');
        tr.setInput('failOnStandardError', 'false');
        tr.setInput('connectedServiceNameSelector', 'connectedServiceNameARM');
        tr.setInput('connectedServiceNameARM', 'AzureRM');
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
    it('should logout of AzureRM if shell script execution failed (scripPath)',(done) => {
        setResponseFile('scriptExecutionFailed.json');

        var tr = new trm.TaskRunner('AzureCLI');
        tr.setInput('scriptLocation', 'scriptPath');
        tr.setInput('scriptPath', 'scriptfail.sh');
        tr.setInput('cwd', 'fake/wd');
        tr.setInput('args', 'arg1');
        tr.setInput('failOnStandardError', 'false');
        tr.setInput('connectedServiceNameSelector', 'connectedServiceNameARM');
        tr.setInput('connectedServiceNameARM', 'AzureRM');
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
    it('should logout of AzureClassic if shell script execution failed (scriptPath)',(done) => {
        var responseFileName:string = 'scriptExecutionFailed.json';
        addSubscriptionObjectJson(responseFileName, publishsettingFileName);
        setResponseFile(responseFileName);

        var tr = new trm.TaskRunner('AzureCLI', false, false, true);
        tr.setInput('scriptLocation', 'scriptPath');
        tr.setInput('scriptPath', 'scriptfail.sh');
        tr.setInput('cwd', 'fake/wd');
        tr.setInput('args', 'arg1');
        tr.setInput('failOnStandardError', 'false');
        tr.setInput('connectedServiceNameSelector', 'connectedServiceName');
        tr.setInput('connectedServiceName', 'AzureClassic');
        tr.run()
            .then(() => {
                deleteSubscriptionObjectJson(responseFileName, publishsettingFileName);
                assert(tr.invokedToolCount == 5, 'logout happened when bash fails');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })
    it('should logout of AzureClassic if batch script execution failed (scriptPath)',(done) => {
        var responseFileName:string = 'scriptExecutionFailed.json';
        addSubscriptionObjectJson(responseFileName, publishsettingFileName);
        setResponseFile(responseFileName);

        var tr = new trm.TaskRunner('AzureCLI', false, false, true);
        tr.setInput('scriptLocation', 'scriptPath');
        tr.setInput('scriptPath', 'scriptfail.bat');
        tr.setInput('cwd', 'fake/wd');
        tr.setInput('args', 'arg1');
        tr.setInput('failOnStandardError', 'false');
        tr.setInput('connectedServiceNameSelector', 'connectedServiceName');
        tr.setInput('connectedServiceName', 'AzureClassic');
        tr.run()
            .then(() => {
                deleteSubscriptionObjectJson(responseFileName, publishsettingFileName);
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
        setResponseFile('toolnotfoundFails.json');

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
    it('task should fail if cmd not found',(done) => {
        setResponseFile('toolnotfoundFails.json');

        var tr = new trm.TaskRunner('AzureCLI');
        tr.setInput('scriptLocation', 'scriptPath');
        tr.setInput('cwd', 'fake/wd');
        tr.setInput('scriptPath', 'script.bat');
        tr.setInput('args', 'args1');
        tr.setInput('failOnStandardError', 'false');
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
        tr.setInput('scriptLocation', 'scriptPath');
        tr.setInput('cwd', 'fake/wd');
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