/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/shelljs.d.ts"/>

import assert = require('assert');
import trm = require('../../lib/taskRunner');
import path = require('path');
import shell = require ('shelljs');

function setResponseFile(name: string) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('AzureRmWebAppDeployment Suite', function() {
    this.timeout(20000);

    var taskSrcPath = path.join (__dirname, '..', '..', '..', 'Tasks', 'AzureRmWebAppDeployment');
    var testSrcPath = path.join (__dirname, '..', '..', '..', '..', 'Tests', 'L0', 'AzureRmWebAppDeployment');

    before((done) => {
        // init here

        if(shell.test ('-d', taskSrcPath)) {
             
            // Move mocked AzureRMUtil and MSDeployUtility Libraries to task's test location
            shell.mv( '-f', path.join (taskSrcPath,'AzureRMUtil.js'), path.join (taskSrcPath,'AzureRMUtil_backup.js'));
            shell.cp(path.join (testSrcPath, 'AzureRMUtil.js'), path.join (taskSrcPath,'AzureRMUtil.js'));

            shell.mv( '-f', path.join (taskSrcPath,'MSDeployUtility.js'), path.join (taskSrcPath,'MSDeployUtility_backup.js'));
            shell.cp(path.join (testSrcPath, 'MSDeployUtility.js'), path.join (taskSrcPath,'MSDeployUtility.js'));
        }

        done();
    });

    after(function() {

        // Restore the original libraries
        shell.mv('-f', path.join (taskSrcPath, 'AzureRMUtil_backup.js'), path.join (taskSrcPath,'AzureRMUtil.js'));
        shell.mv('-f', path.join (taskSrcPath, 'MSDeployUtility_backup.js'), path.join (taskSrcPath,'MSDeployUtility.js'));

    });

    it('Runs successfully with default inputs', (done) => {
        
        setResponseFile('armGood.json');

        var tr = new trm.TaskRunner('AzureRmWebAppDeployment');
        tr.setInput('ConnectedServiceName', 'AzureRMSpn');
        tr.setInput('WebAppName', 'mytestapp');
        tr.setInput('Package', 'webAppPkg.zip');
        tr.setInput('UseWebDeploy', 'true');
        
        tr.run()
            .then(() => {

                assert(tr.invokedToolCount == 2, 'should have invoked tool twice');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();

            })
            .fail((err) => {
                done(err);
            });
    });

    it('Runs successfully with all other inputs', (done) => {
        
        setResponseFile('armGoodOtherInputs.json');

        var tr = new trm.TaskRunner('AzureRmWebAppDeployment');
        tr.setInput('ConnectedServiceName', 'AzureRMSpn');
        tr.setInput('WebAppName', 'mytestapp');
        tr.setInput('Package', 'webAppPkg.zip');
        tr.setInput('UseWebDeploy', 'true');
        tr.setInput('RemoveAdditionalFilesFlag', 'true');
        tr.setInput('ExcludeFilesFromAppDataFlag', 'true');
        tr.setInput('TakeAppOfflineFlag', 'false');
        tr.setInput('VirtualApplication', 'virtualApp');
        tr.setInput('AdditionalArguments', 'additionalArguments');
        tr.setInput('WebAppUri', 'someuri');

        tr.run()
            .then(() => {
               
                assert(tr.invokedToolCount == 2, 'should have invoked tool twice');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();

            })
            .fail((err) => {
                done(err);
            });
    });

    it('Runs successfully with default inputs for deployment to specific slot', (done) => {
        
        setResponseFile('armGood.json');

        var tr = new trm.TaskRunner('AzureRmWebAppDeployment');
        tr.setInput('ConnectedServiceName', 'AzureRMSpn');
        tr.setInput('WebAppName', 'mytestapp');
        tr.setInput('Package', 'webAppPkg.zip');
        tr.setInput('UseWebDeploy', 'true');
        tr.setInput('DeployToSlotFlag', 'true');
        tr.setInput('ResourceGroupName', 'mytestappRg');
        tr.setInput('SlotName', 'testslot');
        
        tr.run()
            .then(() => {

                assert(tr.invokedToolCount == 2, 'should have invoked tool twice');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();

            })
            .fail((err) => {
                done(err);
            });
    });
   
    it('Runs successfully with parameter file present in package', (done) => {
        
        setResponseFile('armGoodWithParamFile.json');

        var tr = new trm.TaskRunner('AzureRmWebAppDeployment');
        tr.setInput('ConnectedServiceName', 'AzureRMSpn');
        tr.setInput('WebAppName', 'mytestapp');
        tr.setInput('Package', 'webAppPkg.zip');
        tr.setInput('UseWebDeploy', 'true');
        
        tr.run()
            .then(() => {
               
                assert(tr.invokedToolCount == 2, 'should have invoked tool twice');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();

            })
            .fail((err) => {
                done(err);
            });
    });

    it('Runs with parameter file provided by user', (done) => {
        
        setResponseFile('armGoodWithParamFileUser.json');

        var tr = new trm.TaskRunner('AzureRmWebAppDeployment');
        tr.setInput('ConnectedServiceName', 'AzureRMSpn');
        tr.setInput('WebAppName', 'mytestapp');
        tr.setInput('Package', 'webAppPkg.zip');
        tr.setInput('UseWebDeploy', 'true');
        tr.setInput('SetParametersFile', 'parameterFile.xml');

        tr.run()
            .then(() => {

                assert(tr.invokedToolCount == 2, 'should have invoked tool twice');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();

            })
            .fail((err) => {
                done(err);
            });
    });
    
    it('Fails if parameters file provided by user is invalid', (done) => {
        
        setResponseFile('armGoodWithParamFileUser.json');

        var tr = new trm.TaskRunner('AzureRmWebAppDeployment');
        tr.setInput('ConnectedServiceName', 'AzureRMSpn');
        tr.setInput('WebAppName', 'mytestapp');
        tr.setInput('Package', 'webAppPkg.zip');
        tr.setInput('UseWebDeploy', 'true');
        tr.setInput('SetParametersFile', 'invalidparameterFile.xml');

        tr.run()
            .then(() => {

                assert(tr.invokedToolCount == 1, 'should have invoked tool once');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                var expectedErr = 'Error: Set parameters file not found: invalidparameterFile.xml'; 
                assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr);
                assert(tr.failed, 'task should have succeeded');
                done();

            })
            .fail((err) => {
                done(err);
            });
    });

    it('Fails if SPN details are missing', (done) => {
        
        setResponseFile('armGood.json');

        var tr = new trm.TaskRunner('AzureRmWebAppDeployment');
        tr.setInput('WebAppName', 'mytestapp');
        tr.setInput('Package', 'webAppPkg.zip');
        tr.setInput('UseWebDeploy', 'true');
        
        tr.run()
            .then(() => {

                assert(tr.invokedToolCount == 0, 'should not have invoked any tool');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                var expectedErr = 'Input required: ConnectedServiceName'; 
                assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr); 
                assert(tr.failed, 'task should have failed');
                done();

            })
            .fail((err) => {
                done(err);
            });
    });

    it('Fails if webapp name is not provided', (done) => {
        
        setResponseFile('armGood.json');

        var tr = new trm.TaskRunner('AzureRmWebAppDeployment');
        tr.setInput('ConnectedServiceName', 'AzureRMSpn');
        tr.setInput('Package', 'webAppPkg.zip');
        tr.setInput('UseWebDeploy', 'true');
        
        tr.run()
            .then(() => {

                assert(tr.invokedToolCount == 0, 'should not have invoked any tool');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                var expectedErr = 'Input required: WebAppName'; 
                assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr); 
                assert(tr.failed, 'task should have failed');
                done();

            })
            .fail((err) => {
                done(err);
            });
    });

    it('Fails if package or folder name is not provided', (done) => {
        
        setResponseFile('armGood.json');

        var tr = new trm.TaskRunner('AzureRmWebAppDeployment');
        tr.setInput('ConnectedServiceName', 'AzureRMSpn');
        tr.setInput('WebAppName', 'mytestapp');
        tr.setInput('UseWebDeploy', 'true');
        
        tr.run()
            .then(() => {

                assert(tr.invokedToolCount == 0, 'should not have invoked any tool');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                var expectedErr = 'Input required: Package'; 
                assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr); 
                assert(tr.failed, 'task should have failed');
                done();

            })
            .fail((err) => {
                done(err);
            });
    });

    it('Fails if package or folder name is invalid', (done) => {
        
        setResponseFile('armGood.json');

        var tr = new trm.TaskRunner('AzureRmWebAppDeployment');
        tr.setInput('ConnectedServiceName', 'AzureRMSpn');
        tr.setInput('WebAppName', 'mytestapp');
        tr.setInput('Package', 'Invalid_webAppPkg');
        tr.setInput('UseWebDeploy', 'true');
        
        tr.run()
            .then(() => {

                assert(tr.invokedToolCount == 0, 'should not have invoked any tool');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                var expectedErr = 'Error: Invalid webapp package or folder path provided: Invalid_webAppPkg'; 
                assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr); 
                assert(tr.failed, 'task should have failed');
                done();

            })
            .fail((err) => {
                done(err);
            });
    });

    it('Runs successfully with Folder Deployment', (done) => {
        
        setResponseFile('armFolderGood.json');

        var tr = new trm.TaskRunner('AzureRmWebAppDeployment');
        tr.setInput('ConnectedServiceName', 'AzureRMSpn');
        tr.setInput('WebAppName', 'mytestapp');
        tr.setInput('Package', 'webAppPkg');
        tr.setInput('UseWebDeploy', 'true');
        
        tr.run()
            .then(() => {

                assert(tr.invokedToolCount == 1, 'should not have invoked any tool');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have failed');
                done();

            })
            .fail((err) => {
                done(err);
            });
    });
   
});