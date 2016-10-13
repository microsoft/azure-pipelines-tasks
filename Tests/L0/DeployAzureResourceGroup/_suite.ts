/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import assert = require('assert');
import trm = require('../../lib/taskRunner');
import path = require('path');
import os = require('os');
import fs = require('fs');
import shell = require ('shelljs');

function setResponseFile(name: string) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('Resource Group Operations', function () {
    this.timeout(20000);
    var taskSrcPath = path.join (__dirname, '..', '..', '..', 'Tasks', 'DeployAzureResourceGroup');
    var testSrcPath = path.join (__dirname, '..', '..', '..',  'Tests', 'L0', 'DeployAzureResourceGroup');

    before((done) => {
        // init here
        
        if(shell.test ('-d', taskSrcPath)) {
             
            // Move mocked AzureRMUtil, MSDeployUtility and KuduUtility Libraries to task's test location
            shell.mv( '-f', path.join (taskSrcPath,'node_modules',"azure-arm-compute"), path.join (taskSrcPath,'azure-arm-compute-backup'));
            shell.mv( '-f', path.join (taskSrcPath,'node_modules',"azure-arm-network"), path.join (taskSrcPath,'azure-arm-network-backup'));
            shell.mv( '-f', path.join (taskSrcPath,'node_modules',"azure-arm-resource"), path.join (taskSrcPath,'azure-arm-resource-backup'));
            shell.cp('-r', path.join (testSrcPath, 'mock_node_modules', "*"), path.join (taskSrcPath,'node_modules'));
        }
        
        done();
    });
    before((done) => {
        done();
    });

    after(function () {
    });

    function createOrUpdateRG_Success() {
        var tr = new trm.TaskRunner('AzureDeploymentResourceGroup');
        tr.setInput("action", "Create Or Update Resource Group");
        tr.setInput("ConnectedServiceNameSelector", "ConnectedServiceName");
        tr.setInput("ConnectedServiceName", "");
        tr.setInput("resourceGroupName", "dummy");
        tr.setInput("location", "West US");
        tr.setInput("csmFile", "");
        tr.setInput("csmParametersFile", "");
        tr.setInput("overrideParameters", "");
        tr.setInput("deploymentMode","Complete");
        return tr;
    }
    
    function selectRG_Success() {
        var tr = new trm.TaskRunner('AzureDeploymentResourceGroup');
        tr.setInput("action", "Create Or Update Resource Group");
        tr.setInput("ConnectedServiceNameSelector", "ConnectedServiceName");
        tr.setInput("ConnectedServiceName", "");
        tr.setInput("resourceGroupName", "dummy");
        tr.setInput("outputVariable", "output");
        return tr;
    }

    it('Selected Resource Group', (done) => {
        var tr = selectRG_Success();
        tr.run()
            .then(() => {
                assert(tr.succeeded, "Task should have succeeded");
                assert(process.env["output"], "Should have written to the output variable")
            });
    });

});