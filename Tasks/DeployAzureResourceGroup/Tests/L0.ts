/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import assert = require('assert');
import * as ttm from 'vsts-task-lib/mock-test';
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import os = require('os');
import fs = require('fs');
var shell = require ('shelljs');

function setResponseFile(name: string) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('Azure Resource Group Deployment', function () {
    this.timeout(30000);
    var taskSrcPath = path.join (__dirname, '..');
    var testSrcPath = path.join (__dirname );

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
        var tr = new tmrm.TaskMockRunner('AzureResourceGroupDeployment');
        tr.setInput("action", "Create Or Update Resource Group");
        tr.setInput("ConnectedServiceName", "AzureRM");
        tr.setInput("resourceGroupName", "dummy");
        tr.setInput("location", "West US");
        tr.setInput("templateLocation", "Linked Artifact")
        tr.setInput("csmFile", testSrcPath + "\\CSM.json");
        tr.setInput("overrideParameters", "");
        tr.setInput("deploymentMode","Complete");
        return tr;
    }

    it('Successfully triggered createOrUpdate deployment', (done) => {
        let tp = path.join(__dirname, 'createOrUpdate.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run()
        assert(tr.succeeded, "Should have succeeded");
        assert(tr.stdout.indexOf("deployments.createOrUpdate is called") > 0, "deployments.createOrUpdate function should have been called from azure-sdk");
        done();
    });

    // it('Create or Update RG, failed on faulty CSM template file', (done) => {
    //     var tr = createOrUpdateRG();
    //     tr.setInput("csmFile", testSrcPath+"\\faultyCSM.json");
    //     tr.run()
    //         .then(()=> {
    //             assert(tr.failed, "Task should have failed");
    //             assert(tr.stdout.indexOf("deployments.createOrUpdate is called") == -1, "Task should have failed before calling deployments.createOrUpdate function from azure-sdk");
    //             done();
    //         })
    //         .fail((err) => {
    //             console.log(tr.stdout);
    //             console.error(tr.stderr);
    //             done(err);
    //         });
    // })

    
    // function selectRG() {
    //     var tr = new trm.TaskRunner('AzureResourceGroupDeployment');
    //     tr.setInput("action", "Select Resource Group");
    //     tr.setInput("ConnectedServiceName", "AzureRM");
    //     tr.setInput("resourceGroupName", "AzureRM");
    //     return tr;
    // }

    // it('Selected Resource Group successfully', (done) => {
    //     var tr = selectRG();
    //     tr.setInput("outputVariable", "output.variable.custom");
    //     tr.run()
    //         .then(() => {
    //             assert(tr.succeeded, "Task should have succeeded");
    //             assert(tr.stdout.indexOf("set output.variable.custom") >= 0, "Should have written to the output variable.");
    //             assert(tr.stdout.indexOf("networkInterfaces.list is called")>0, "Should have called networkInterfaces.list from azure-sdk");
    //             assert(tr.stdout.indexOf("publicIPAddresses.list is called")>0, "Should have called publicIPAddresses.list from azure-sdk");
    //             assert(tr.stdout.indexOf("virtualMachines.list is called")>0, "Should have called virtualMachines.list from azure-sdk");
    //             done();                
    //         }).fail((err) => {
    //             console.log(tr.stdout);
    //             console.error(tr.stderr);
    //             done(err);
    //         });
    // });

    // it('Select Resource Group failed on null or empty output Variable', (done) => {
    //     var tr = selectRG();
    //     tr.run()
    //         .then(() => {
    //             assert(tr.failed, "Task should have failed");
    //             assert(tr.stdout.indexOf("Output variable should not be empty") > 0, "Should have logged the output variable requirement.");
    //         }).fail((err) => {
    //             console.log(tr.stdout);
    //             console.error(tr.stderr);
    //             done(err);
    //     });

    //     tr.setInput("outputVariable", "");
    //     tr.run()
    //         .then(() => {
    //             assert(tr.failed, "Task should have failed");
    //             assert(tr.stdout.indexOf("Output variable should not be empty") > 0, "Should have logged the output variable requirement.");
    //             done();                
    //         }).fail((err) => {
    //             console.log(tr.stdout);
    //             console.error(tr.stderr);
    //             done(err);
    //         });
    // });

    // function VMOperations(operation) {
    //     var tr = new trm.TaskRunner('AzureResourceGroupDeployment');
    //     tr.setInput("action", operation);
    //     tr.setInput("ConnectedServiceName", "AzureRM");
    //     tr.setInput("resourceGroupName", "dummy");
    //     return tr;
    // }

    // it("Deleted Resource Group", (done) => {
    //     var tr = new trm.TaskRunner('AzureResourceGroupDeployment');
    //     tr.setInput("action", "DeleteRG");
    //     tr.setInput("ConnectedServiceName", "AzureRM");
    //     tr.setInput("resourceGroupName", "dummy");
    //     tr.run()
    //     .then(() => {
    //         assert(tr.succeeded, "Task should have succeeded");
    //         assert(tr.stdout.indexOf("Deleting Resource Group") > 0, "Delete Resource Group function should have been called");
    //         assert(tr.stdout.indexOf("resourceGroups.deleteMethod is called") > 0, "Task should have called resourceGroups.deleteMethod function from azure-sdk");
    //         done();
    //     }).fail((err) => {
    //             console.log(tr.stdout);
    //             console.error(tr.stderr);
    //             done(err);
    //     });

    // })

    // it('Started VMs', (done) => {
    //     var tr = VMOperations("Start");
    //     tr.run()
    //         .then(( )=> {
    //             assert(tr.succeeded, "Task should have succeeded");
    //             assert(tr.stdout.indexOf("Starting... customVM") > 0, "Should have started VM");
    //             assert(tr.stdout.indexOf("virtualMachines.start is called") > 0, "Should have called virtualMachines.start function from azure-sdk")
    //             done();
    //         })
    //         .fail((err) => {
    //             console.log(tr.stdout);
    //             console.error(tr.stderr);
    //             done(err);
    //         })
    // });

    // it('Stopped VMs', (done) => {
    //     var tr = VMOperations("Stop");
    //     tr.run()
    //         .then(( )=> {
    //             assert(tr.succeeded, "Task should have succeeded");
    //             assert(tr.stdout.indexOf("Stopping... customVM") > 0, "Should have started VM");
    //             assert(tr.stdout.indexOf("virtualMachines.powerOff is called") > 0, "Should have called virtualMachines.powerOff function from azure-sdk");
    //             done();
    //         })
    //         .fail((err) => {
    //             console.log(tr.stdout);
    //             console.error(tr.stderr);
    //             done(err);
    //         })
    // });

    // it('Restarted VMs', (done) => {
    //     var tr = VMOperations("Restart");
    //     tr.run()
    //         .then(( )=> {
    //             assert(tr.succeeded, "Task should have succeeded");
    //             assert(tr.stdout.indexOf("Restarting... customVM") > 0, "Should have started VM");
    //             assert(tr.stdout.indexOf("virtualMachines.restart is called") > 0, "Should have called virtualMachines.restart function from azure-sdk");
    //             done();
    //         })
    //         .fail((err) => {
    //             console.log(tr.stdout);
    //             console.error(tr.stderr);
    //             done(err);
    //         })
    // });

    // it('Deleted VMs', (done) => {
    //     var tr = VMOperations("Delete");
    //     tr.run()
    //         .then(( )=> {
    //             assert(tr.succeeded, "Task should have succeeded");
    //             assert(tr.stdout.indexOf("Deleting... customVM") > 0, "Should have started VM");
    //             assert(tr.stdout.indexOf("virtualMachines.deleteMethod is called") > 0, "Should have called virtualMachines.deleteMethod function from azure-sdk")
    //             done();
    //         })
    //         .fail((err) => {
    //             console.log(tr.stdout);
    //             console.error(tr.stderr);
    //             done(err);
    //         })
    // });
});
