/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import assert = require('assert');
import trm = require('../../lib/taskRunner');
import path = require('path');
import os = require('os');
import fs = require('fs');
import shell = require ('shelljs');

import tl = require("../../lib/vsts-task-lib/task");

function setResponseFile(name: string) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('Azure Resource Group Deployment', function () {
    this.timeout(30000);
    var taskSrcPath = path.join (__dirname, '..', '..', '..', 'Tasks', 'AzureResourceGroupDeployment');
    var testSrcPath = path.join (__dirname, '..', '..', '..', "..", 'Tests', 'L0', 'DeployAzureResourceGroup');

    before((done) => {
        // init here
        if(shell.test ('-d', taskSrcPath)) {
            shell.mv( '-f', path.join (taskSrcPath,'node_modules',"azure-arm-compute"), path.join (taskSrcPath,'azure-arm-compute-backup'));
            shell.mv( '-f', path.join (taskSrcPath,'node_modules',"azure-arm-network"), path.join (taskSrcPath,'azure-arm-network-backup'));
            shell.mv( '-f', path.join (taskSrcPath,'node_modules',"azure-arm-resource"), path.join (taskSrcPath,'azure-arm-resource-backup'));
            
            shell.cp( '-rf', path.join (testSrcPath,'mock_node_modules',"azure-arm-compute"), path.join (taskSrcPath,'node_modules'));
            shell.cp( '-rf', path.join (testSrcPath,'mock_node_modules',"azure-arm-resource"), path.join (taskSrcPath,'node_modules'));
            shell.cp( '-rf', path.join (testSrcPath,'mock_node_modules',"azure-arm-network"), path.join (taskSrcPath,'node_modules'));
        }
        setResponseFile("defaults.json")
        done();
    });
    before((done) => {
        done();
    });

    after(function () {
    });

    function createOrUpdateRG() {
        var tr = new trm.TaskRunner('AzureResourceGroupDeployment');
        tr.setInput("action", "Create Or Update Resource Group");
        tr.setInput("ConnectedServiceNameSelector", "ConnectedServiceName");
        tr.setInput("ConnectedServiceName", "AzureRM");
        tr.setInput("resourceGroupName", "dummy");
        tr.setInput("location", "West US");
        tr.setInput("csmFile", testSrcPath + "\\CSM.json");
        tr.setInput("overrideParameters", "");
        tr.setInput("deploymentMode","Complete");
        return tr;
    }

    it('Successfully triggered createOrUpdate deployment', (done) => {
        var tr = createOrUpdateRG();
        tr.setInput("csmParametersFile",testSrcPath + "\\CSM.json" );
        tr.run()
            .then(() => {
                assert(tr.succeeded, "Should have succeeded");
                done();
          }).fail((err) => {
                console.log(tr.stdout);
                console.error(tr.stderr);
                done(err);
        });
    });

    it('Create or Update RG, failed on faulty CSM template file', (done) => {
        var tr = createOrUpdateRG();
        tr.setInput("csmFile", testSrcPath+"\\faultyCSM.json");
        tr.run()
            .then(()=> {
                assert(tr.failed, "Task should have failed");
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.error(tr.stderr);
                done(err);
            });
    })

    
    function selectRG() {
        var tr = new trm.TaskRunner('AzureResourceGroupDeployment');
        tr.setInput("action", "Select Resource Group");
        tr.setInput("ConnectedServiceNameSelector", "ConnectedServiceName");
        tr.setInput("ConnectedServiceName", "AzureRM");
        tr.setInput("resourceGroupName", "AzureRM");
        return tr;
    }

    it('Selected Resource Group successfully', (done) => {
        var tr = selectRG();
        tr.setInput("outputVariable", "output.variable.custom");
        tr.run()
            .then(() => {
                assert(tr.succeeded, "Task should have succeeded");
                assert(tr.stdout.indexOf("set output.variable.custom")>=0, "Should have written to the output variable ......... ");
                done();                
            }).fail((err) => {
                console.log(tr.stdout);
                console.error(tr.stderr);
                done(err);
            });
    });

    it('Select Resource Group failed on null or empty output Variable', (done) => {
        var tr = selectRG();
        tr.run()
            .then(() => {
                assert(tr.failed, "Task should have failed");
            }).fail((err) => {
                console.log(tr.stdout);
                console.error(tr.stderr);
                done(err);
        });

        tr.setInput("outputVariable", "");
        tr.run()
            .then(() => {
                assert(tr.failed, "Task should have failed");
                done();                
            }).fail((err) => {
                console.log(tr.stdout);
                console.error(tr.stderr);
                done(err);
            });
    });

    function VMOperations(operation) {
        var tr = new trm.TaskRunner('AzureResourceGroupDeployment');
        tr.setInput("action", operation);
        tr.setInput("ConnectedServiceNameSelector", "ConnectedServiceName");
        tr.setInput("ConnectedServiceName", "AzureRM");
        tr.setInput("resourceGroupName", "dummy");
        return tr;
    }

    it('Started VMs', (done) => {
        var tr = VMOperations("Start");
        tr.run()
            .then(( )=> {
                assert(tr.succeeded, "Task should have succeeded");
                assert(tr.stdout.indexOf("Starting... customVM") > 0, "Should have started VM");
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.error(tr.stderr);
                done(err);
            })
    });

    it('Stopped VMs', (done) => {
        var tr = VMOperations("Stop");
        tr.run()
            .then(( )=> {
                assert(tr.succeeded, "Task should have succeeded");
                assert(tr.stdout.indexOf("Stopping... customVM") > 0, "Should have started VM");
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.error(tr.stderr);
                done(err);
            })
    });

    it('Restarted VMs', (done) => {
        var tr = VMOperations("Restart");
        tr.run()
            .then(( )=> {
                assert(tr.succeeded, "Task should have succeeded");
                assert(tr.stdout.indexOf("Restarting... customVM") > 0, "Should have started VM");
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.error(tr.stderr);
                done(err);
            })
    });

    it('Deleted VMs', (done) => {
        var tr = VMOperations("Delete");
        tr.run()
            .then(( )=> {
                assert(tr.succeeded, "Task should have succeeded");
                assert(tr.stdout.indexOf("Deleting... customVM") > 0, "Should have started VM");
                done();
            })
            .fail((err) => {
                console.log(tr.stdout);
                console.error(tr.stderr);
                done(err);
            })
    });
});
