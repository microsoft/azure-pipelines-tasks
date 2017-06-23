'use strict';

const assert = require('assert');
const ttm = require('vsts-task-lib/mock-test');
const path = require('path');

function setResponseFile(name) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

function runValidations(validator: () => {}, tr, done) {
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
    it("image update should succeed", (done) => {
        let tp = path.join(__dirname, "updateImage.js");
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        runValidations(() => {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("virtualMachineScaleSets.list is called") > 0, "virtualMachineScaleSets.list function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("virtualMachinesScaleSets.updateImage is called") > 0, "virtualMachinesScaleSets.updateImage function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("loc_mock_UpdatedVMSSImage") > 0, "VMSS image should be updated");
        }, tr, done);
    });

    it("image update should succeed", (done) => {
        process.env["imageUpdateErrorString"] = "Can not update image as it uses platform image";

        let tp = path.join(__dirname, "updateImage.js");
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.failed, "Should have failed");
            assert(tr.stdout.indexOf("virtualMachineScaleSets.list is called") > 0, "virtualMachineScaleSets.list function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("virtualMachinesScaleSets.updateImage is called") > 0, "virtualMachinesScaleSets.updateImage function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("loc_mock_VMSSImageUpdateFailed Can not update image as it uses platform image") > 0, "VMSS image update should fail");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
});
