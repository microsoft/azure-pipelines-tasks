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
    this.timeout(35000);

    var taskSrcPath = path.join (__dirname, '..', '..', '..', 'Tasks', 'AzureRmWebAppDeployment');
    var testSrcPath = path.join (__dirname, '..', '..', '..', '..', 'Tests', 'L0', 'AzureRmWebAppDeployment');

    before((done) => {
        // init here
        
        if(shell.test ('-d', taskSrcPath)) {
             
            // Move mocked AzureRMUtil, MSDeployUtility and KuduUtility Libraries to task's test location
            shell.mv( '-f', path.join (taskSrcPath,'AzureRMUtil.js'), path.join (taskSrcPath,'AzureRMUtil_backup.js'));
            shell.cp(path.join (testSrcPath, 'AzureRMUtil.js'), path.join (taskSrcPath,'AzureRMUtil.js'));

            shell.mv( '-f', path.join (taskSrcPath,'MSDeployUtility.js'), path.join (taskSrcPath,'MSDeployUtility_backup.js'));
            shell.cp(path.join (testSrcPath, 'MSDeployUtility.js'), path.join (taskSrcPath,'MSDeployUtility.js'));

            shell.mv( '-f', path.join (taskSrcPath,'kuduUtility.js'), path.join (taskSrcPath,'kuduUtility_backup.js'));
            shell.cp(path.join (testSrcPath, 'kuduUtility.js'), path.join (taskSrcPath,'kuduUtility.js'));

        }
        
        done();
    });

    after(function() {

        // Restore the original libraries
        shell.mv('-f', path.join (taskSrcPath, 'AzureRMUtil_backup.js'), path.join (taskSrcPath,'AzureRMUtil.js'));
        shell.mv('-f', path.join (taskSrcPath, 'MSDeployUtility_backup.js'), path.join (taskSrcPath,'MSDeployUtility.js'));
        shell.mv('-f', path.join (taskSrcPath, 'kuduUtility_backup.js'), path.join (taskSrcPath,'kuduUtility.js'));

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
                var expectedOut = 'Updated history to kudu'; 
                assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
                done();

            })
            .fail((err) => {
                done(err);
            });
    });

    it('Runs successfully with all other inputs', (done) => {
        
        setResponseFile('armGood.json');

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
                var expectedOut = 'Updated history to kudu'; 
                assert(tr.stdout.search(expectedOut) >= 0, 'should have said: ' + expectedOut);
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
                var expectedOut = 'Updated history to kudu'; 
                assert(tr.stdout.search(expectedOut) >= 0, 'should have said: ' + expectedOut);
                assert(tr.succeeded, 'task should have succeeded');
                done();

            })
            .fail((err) => {
                done(err);
            });
    });
    
    it('Fails if msdeploy cmd fails to execute', (done) => {
        
        setResponseFile('armBad.json');

        var tr = new trm.TaskRunner('AzureRmWebAppDeployment');
        tr.setInput('ConnectedServiceName', 'AzureRMSpn');
        tr.setInput('WebAppName', 'mytestapp');
        tr.setInput('Package', 'webAppPkg.zip');
        tr.setInput('UseWebDeploy', 'true');
       
        tr.run()
            .then(() => {

                assert(tr.invokedToolCount == 2, 'should have invoked tool once');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                var expectedErr = 'Error: cmd failed with return code: 1';
                assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr);
                var expectedOut = 'Failed to update history to kudu'; 
                assert(tr.stdout.search(expectedOut) >= 0, 'should have said: ' + expectedOut);
                assert(tr.failed, 'task should have failed');
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
        tr.setInput('SetParametersFile', 'parameterFilePresent.xml');
        
        tr.run()
            .then(() => {

                assert(tr.invokedToolCount == 2, 'should have invoked tool twice');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                var expectedOut = 'Updated history to kudu'; 
                assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
                assert(tr.succeeded, 'task should have succeeded');
                done();

            })
            .fail((err) => {
                done(err);
            });
    });

    it('Runs successfully with parameter file present in package on non-windows', (done) => {
        
        setResponseFile('armGoodWithParamFileNonWindows.json');

        var tr = new trm.TaskRunner('AzureRmWebAppDeployment');
        tr.setInput('ConnectedServiceName', 'AzureRMSpn');
        tr.setInput('WebAppName', 'mytestapp');
        tr.setInput('Package', 'webAppPkg.zip');
        tr.setInput('UseWebDeploy', 'false');
        tr.setInput('SetParametersFile', 'parameterFilePresent.xml');
        
        tr.run()
            .then(() => {
                
                assert(tr.invokedToolCount == 0, 'should not have invoked any tool');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                var expectedOut = 'Deployed using KuduDeploy'; 
                assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
                expectedOut = 'Updated history to kudu'; 
                assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
                done();

            })
            .fail((err) => {
                done(err);
            });
    });

    it('Runs successfully with parameter file provided by user on windows', (done) => {
        
        setResponseFile('armGoodWithParamFile.json');

        var tr = new trm.TaskRunner('AzureRmWebAppDeployment');
        tr.setInput('ConnectedServiceName', 'AzureRMSpn');
        tr.setInput('WebAppName', 'mytestapp');
        tr.setInput('Package', 'webAppPkg.zip');
        tr.setInput('UseWebDeploy', 'true');
        tr.setInput('SetParametersFile', 'parameterFileUser.xml');

        tr.run()
            .then(() => {

                assert(tr.invokedToolCount == 2, 'should have invoked tool twice');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                var expectedOut = 'Updated history to kudu'; 
                assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
                assert(tr.succeeded, 'task should have succeeded');
                done();

            })
            .fail((err) => {
                done(err);
            });
    });
    
    it('Fails if parameters file provided by user is not present', (done) => {
        
        setResponseFile('armGoodWithParamFile.json');

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
    
    it('Fails if more than one package matched with specified pattern', (done) => {
        
        setResponseFile('armGood.json');

        var tr = new trm.TaskRunner('AzureRmWebAppDeployment');
        tr.setInput('ConnectedServiceName', 'AzureRMSpn');
        tr.setInput('WebAppName', 'mytestapp');
        tr.setInput('Package', 'webAppPkgPattern');
        tr.setInput('UseWebDeploy', 'true');
        
        tr.run()
            .then(() => {

                assert(tr.invokedToolCount == 0, 'should not have invoked any tool');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                var expectedErr = 'More than one package matched with specified pattern. Please restrain the search patern.'; 
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
                var expectedErr = 'No package found with specified pattern'; 
                assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr); 
                assert(tr.failed, 'task should have failed');
                done();

            })
            .fail((err) => {
                done(err);
            });
    });

    it('Runs successfully with Folder Deployment', (done) => {
        
        setResponseFile('armGood.json');

        var tr = new trm.TaskRunner('AzureRmWebAppDeployment');
        tr.setInput('ConnectedServiceName', 'AzureRMSpn');
        tr.setInput('WebAppName', 'mytestapp');
        tr.setInput('Package', 'webAppPkg');
        tr.setInput('UseWebDeploy', 'true');
        
        tr.run()
            .then(() => {

                assert(tr.invokedToolCount == 1, 'should have invoked tool once');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have failed');
                done();

            })
            .fail((err) => {
                done(err);
            });
    });

    it('Runs KuduDeploy successfully with default inputs on non-windows agent', (done) => {
        
        setResponseFile('armGoodNonWindows.json');

        var tr = new trm.TaskRunner('AzureRmWebAppDeployment');
        tr.setInput('ConnectedServiceName', 'AzureRMSpn');
        tr.setInput('WebAppName', 'mytestapp');
        tr.setInput('Package', 'webAppPkg.zip');
        tr.setInput('UseWebDeploy', 'false');
       
        tr.run()
            .then(() => {
                
                assert(tr.invokedToolCount == 0, 'should not have invoked any tool');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                var expectedOut = 'Deployed using KuduDeploy'; 
                assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
                expectedOut = 'Updated history to kudu'; 
                assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
                done();

            })
            .fail((err) => {
                done(err);
            });
    });

    it('Runs KuduDeploy successfully with folder archiving on non-windows agent', (done) => {
        
        setResponseFile('armGoodNonWindows.json');

        var tr = new trm.TaskRunner('AzureRmWebAppDeployment');
        tr.setInput('ConnectedServiceName', 'AzureRMSpn');
        tr.setInput('WebAppName', 'mytestapp');
        tr.setInput('Package', 'webAppPkg');
        tr.setInput('UseWebDeploy', 'false');
       
        tr.run()
            .then(() => {

                assert(tr.invokedToolCount == 0, 'should not have invoked any tool');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                var expectedOut = 'Folder Archiving Successful'; 
                assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
                expectedOut = 'Deployed using KuduDeploy'; 
                assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
                expectedOut = 'Updated history to kudu'; 
                assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
                assert(tr.succeeded, 'task should have succeeded');
                done();

            })
            .fail((err) => {
                done(err);
            });
    });
    it('Fails KuduDeploy if parameter file is present in package', (done) => {

        setResponseFile('armGoodNonWindows.json');

        var tr = new trm.TaskRunner('AzureRmWebAppDeployment');
        tr.setInput('ConnectedServiceName', 'AzureRMSpn');
        tr.setInput('WebAppName', 'mytestapp');
        tr.setInput('Package', 'webAppPkg.zip');
        tr.setInput('UseWebDeploy', 'false');
        shell.cp("-f", path.join (testSrcPath,'kuduUtilityBad.js'), path.join (__dirname, '..', '..', 'Temp', 'AzureRmWebAppDeployment', 'kuduUtility.js'));
        tr.run()
            .then(() => {

                assert(tr.invokedToolCount == 0, 'should not have invoked any tool');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                var expectedErr = 'Error: MSDeploy generated package are only supported for Windows platform.'
                assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr);                
                var expectedOut = 'Failed to update history to kudu'; 
                assert(tr.stdout.search(expectedOut) > 0, 'should have said: ' + expectedOut);
                assert(tr.failed, 'task should have failed');
                done();

            })
            .fail((err) => {
                done(err);
            });
    });
    it('Fails KuduDeploy if folder archiving fails', (done) => {
           
        setResponseFile('armGoodNonWindows.json');

        var tr = new trm.TaskRunner('AzureRmWebAppDeployment');
        tr.setInput('ConnectedServiceName', 'AzureRMSpn');
        tr.setInput('WebAppName', 'mytestapp');
        tr.setInput('Package', 'webAppPkg');
        tr.setInput('UseWebDeploy', 'false');

        shell.cp("-f", path.join (testSrcPath,'kuduUtilityBad.js'), path.join (__dirname, '..', '..', 'Temp', 'AzureRmWebAppDeployment', 'kuduUtility.js'));
        tr.run()
            .then(() => {

                assert(tr.invokedToolCount == 0, 'should not have invoked any tool');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                var expectedErr = 'Error: Folder Archiving Failed'; 
                assert(tr.stdErrContained(expectedErr), 'should have said: ' + expectedErr); 
                assert(tr.failed, 'task should have failed');
                done();

            })
            .fail((err) => {
                done(err);
            });
    });

});