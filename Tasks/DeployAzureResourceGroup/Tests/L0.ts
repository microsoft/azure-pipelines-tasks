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
    before((done) => {
        done();
    });

    after(function () {
    });

    it('Successfully triggered createOrUpdate deployment', (done) => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "\\CSM.json";
        process.env["csmParametersFile"] = "\\CSM.json";
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") > 0, "deployments.createOrUpdate function should have been called from azure-sdk");
            done();
        } catch(error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
        
    });

    it('Create or Update RG, failed on faulty CSM template file', (done) => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "\\faultyCSM.json";
        process.env["csmParametersFile"] = "\\faultyCSM.json";
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run()
        try{
            assert(tr.failed, "Task should have failed");
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") == -1, "Task should have failed before calling deployments.createOrUpdate function from azure-sdk");
        } catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
        done();
    })

    
    it('Selected Resource Group successfully', (done) => {
        let tp = path.join(__dirname, 'selectResourceGroup.js');
        process.env["outputVariable"] = "output.variable.custom";
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("set output.variable.custom") >= 0, "Should have written to the output variable.");
            assert(tr.stdout.indexOf("networkInterfaces.list is called")>0, "Should have called networkInterfaces.list from azure-sdk");
            assert(tr.stdout.indexOf("publicIPAddresses.list is called")>0, "Should have called publicIPAddresses.list from azure-sdk");
            assert(tr.stdout.indexOf("virtualMachines.list is called")>0, "Should have called virtualMachines.list from azure-sdk");
            done(); 
        } catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }               
    });

    it('Select Resource Group failed on empty output Variable', (done) => {
        let tp = path.join(__dirname, 'selectResourceGroup.js');
        process.env["outputVariable"] = "";
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.failed, "Task should have failed");
            assert(tr.stdout.indexOf("Output variable should not be empty") > 0, "Should have logged the output variable requirement.");
            done();
        } catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }                
    });

    it("Deleted Resource Group", (done) => {
        let tp = path.join(__dirname, 'deleteResourceGroup.js');
        process.env["outputVariable"] = null;
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loc_mock_ARG_DeletingResourceGroup") > 0, "Delete Resource Group function should have been called");
            assert(tr.stdout.indexOf("resourceGroups.deleteMethod is called") > 0, "Task should have called resourceGroups.deleteMethod function from azure-sdk");
            done();
        } catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    })

    it('Started VMs', (done) => {
        let tp = path.join(__dirname, 'VMOperations.js');
        process.env["operation"] = "Start";
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loc_mock_VM_Start") > 0, "Should have started VM");
            assert(tr.stdout.indexOf("virtualMachines.start is called") > 0, "Should have called virtualMachines.start function from azure-sdk")
            done();
        } catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });

    it('Stopped VMs', (done) => {
        let tp = path.join(__dirname, 'VMOperations.js');
        process.env["operation"] = "Stop";
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loc_mock_VM_Stop") > 0, "Should have started VM");
            assert(tr.stdout.indexOf("virtualMachines.powerOff is called") > 0, "Should have called virtualMachines.powerOff function from azure-sdk");
            done();
        } catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });

    it('Restarted VMs', (done) => {
        let tp = path.join(__dirname, 'VMOperations.js');
        process.env["operation"] = "Restart";
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loc_mock_VM_Restart") > 0, "Should have started VM");
            assert(tr.stdout.indexOf("virtualMachines.restart is called") > 0, "Should have called virtualMachines.restart function from azure-sdk");
            done();
        } catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });

    it('Deleted VMs', (done) => {
        let tp = path.join(__dirname, 'VMOperations.js');
        process.env["operation"] = "Delete";
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Task should have succeeded");
            assert(tr.stdout.indexOf("loc_mock_VM_Delete") > 0, "Should have started VM");
            assert(tr.stdout.indexOf("virtualMachines.deleteMethod is called") > 0, "Should have called virtualMachines.deleteMethod function from azure-sdk")
            done();
        } catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
});
