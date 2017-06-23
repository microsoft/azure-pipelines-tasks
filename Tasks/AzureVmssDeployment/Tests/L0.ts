'use strict';

const assert = require('assert');
const ttm = require('vsts-task-lib/mock-test');
const path = require('path');

function setResponseFile(name) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

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

describe('Azure VMSS Deployment', function () {
    this.timeout(30000);
    before((done) => {
        done();
    });
    after(function () {
    });
    it("should succeed if vmss image updated successfully", (done) => {
        let tp = path.join(__dirname, "updateImage.js");
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        runValidations(() => {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("virtualMachineScaleSets.list is called") > -1, "virtualMachineScaleSets.list function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("virtualMachinesScaleSets.updateImage is called with RG: testrg1, VMSS: testvmss1 and imageurl : https://someurl") > -1, "virtualMachinesScaleSets.updateImage function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("loc_mock_UpdatedVMSSImage") > -1, "VMSS image should be updated");
        }, tr, done);
    });

    it("should fail if failed to update VMSS image", (done) => {
        process.env["imageUpdateFailed"] = "true";
        let tp = path.join(__dirname, "updateImage.js");
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        process.env["imageUpdateFailed"] = undefined;

        runValidations(() => {
            assert(tr.failed, "Should have failed");
            assert(tr.stdout.indexOf("virtualMachineScaleSets.list is called") > -1, "virtualMachineScaleSets.list function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("virtualMachinesScaleSets.updateImage is called") > -1, "virtualMachinesScaleSets.updateImage function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("loc_mock_VMSSImageUpdateFailed") > -1, "VMSS image update should fail");
        }, tr, done);
    });

    it("should fail if failed to list VMSSs", (done) => {
        process.env["vmssListFailed"] = "true";
        let tp = path.join(__dirname, "updateImage.js");
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        process.env["vmssListFailed"] = undefined;

        runValidations(() => {
            assert(tr.failed, "Should have failed");
            assert(tr.stdout.indexOf("virtualMachineScaleSets.list is called") > -1, "virtualMachineScaleSets.list function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("virtualMachinesScaleSets.updateImage is called") == -1, "virtualMachinesScaleSets.updateImage function should not be called from azure-sdk");
            assert(tr.stdout.indexOf("loc_mock_VMSSListFetchFailed") > -1, "VMSS list should be failed");
        }, tr, done);
    });

    it("should fail if failed to get matching VMSS", (done) => {
        process.env["noMatchingVmss"] = "true";
        let tp = path.join(__dirname, "updateImage.js");
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        process.env["noMatchingVmss"] = undefined;

        runValidations(() => {
            assert(tr.failed, "Should have failed");
            assert(tr.stdout.indexOf("virtualMachineScaleSets.list is called") > -1, "virtualMachineScaleSets.list function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("virtualMachinesScaleSets.updateImage is called") == -1, "virtualMachinesScaleSets.updateImage function should not be called from azure-sdk");
            assert(tr.stdout.indexOf("loc_mock_FailedToGetRGForVMSS") > -1, "VMSS list should be failed");
        }, tr, done);
    });
});
