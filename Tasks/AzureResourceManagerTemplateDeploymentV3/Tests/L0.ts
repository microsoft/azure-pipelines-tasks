'use strict';

const assert = require('assert');
const ttm = require('azure-pipelines-task-lib/mock-test');
const path = require('path');

function setResponseFile(name) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('Azure Resource Manager Template Deployment', function () {
    this.timeout(60000);
    before((done) => {
        done();
    });
    after(function () {
    });

    process.env['AGENT_HOMEDIRECTORY'] = process.env['AGENT_HOMEDIRECTORY'] || "C:\\temp\\agent\\home";
	process.env['BUILD_SOURCESDIRECTORY'] = process.env['BUILD_SOURCESDIRECTORY'] || "C:\\temp\\agent\\home\\sources",
	process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] || "C:\\temp\\agent\\home";
	process.env["AGENT_TEMPDIRECTORY"] = process.env["AGENT_TEMPDIRECTORY"] || "C:\\temp\\agent\\home\\temp";

//  uncomment to get test traces
//	process.env['TASK_TEST_TRACE'] = "1";

    /*it('Successfully triggered createOrUpdate deployment', (done) => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") > 0, "deployments.createOrUpdate function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("set ") < 0, "deploymentsOutput should not have been updated");
            assert(tr.stdout.indexOf("properly sanitized") > 0, "Parameters should have been sanitized");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });*/
    it('Successfully triggered createOrUpdate deployment and updated deploymentOutputs', (done) => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        process.env["deploymentOutputs"] = "someVar";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("properly sanitized") > 0, "Parameters should have been sanitized");
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") > 0, "deployments.createOrUpdate function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=someVar;]") >= 0, "deploymentsOutput should have been updated");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('Create or Update RG, failed on faulty CSM template file', (done) => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "faultyCSM.json";
        process.env["csmParametersFile"] = "faultyCSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.failed, "Task should have failed");
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") == -1, "Task should have failed before calling deployments.createOrUpdate function from azure-sdk");
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
        done();
    });
    it('Create or Update RG, succeeded on CSM template file with comments', (done) => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSMwithComments.json";
        process.env["csmParametersFile"] = "CSMwithComments.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") > 0, "deployments.createOrUpdate function should have been called from azure-sdk");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
    it('createOrUpdate deployment should fail when no template file is found', (done) => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSMNotThere.json";
        process.env["csmParametersFile"] = "CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(!tr.succeeded, "Should have failed");
            assert(tr.stdout.indexOf("TemplateFilePatternMatchingNoFile") > 0, "should have printed TemplateFilePatternMatchingNoFile")
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") < 0, "deployments.createOrUpdate function should not have been called from azure-sdk");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });

    it('createOrUpdate deployment should fail when multiple template files are found', (done) => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSMmultiple.json";
        process.env["csmParametersFile"] = "CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(!tr.succeeded, "Should have failed");
            assert(tr.stdout.indexOf("TemplateFilePatternMatchingMoreThanOneFile") > 0, "should have printed TemplateFilePatternMatchingMoreThanOneFile")
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") < 0, "deployments.createOrUpdate function should not have been called from azure-sdk");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });

    it('createOrUpdate deployment should fail when no parameter file is found', (done) => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSMNotThere.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(!tr.succeeded, "Should have failed");
            assert(tr.stdout.indexOf("TemplateParameterFilePatternMatchingNoFile") > 0, "should have printed TemplateParameterFilePatternMatchingNoFile")
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") < 0, "deployments.createOrUpdate function should not have been called from azure-sdk");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });

    it('createOrUpdate deployment should fail when multiple template files are found', (done) => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSMmultiple.json";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(!tr.succeeded, "Should have failed");
            assert(tr.stdout.indexOf("TemplateParameterFilePatternMatchingMoreThanOneFile") > 0, "should have printed TemplateFilePatternMatchingMoreThanOneFile")
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") < 0, "deployments.createOrUpdate function should not have been called from azure-sdk");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });

    it('Successfully triggered createOrUpdate deployment using bicep file', (done) => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSMwithBicep.bicep";
        process.env["csmParametersFile"] = "";
        process.env["deploymentOutputs"] = "someVar";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") > 0, "deployments.createOrUpdate function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=someVar;]") >= 0, "deploymentsOutput should have been updated");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });

    it('Successfully triggered createOrUpdate deployment using bicep file with unused params', (done) => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSMwithBicepWithWarning.bicep";
        process.env["csmParametersFile"] = "";
        process.env["deploymentOutputs"] = "someVar";
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        try {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") > 0, "deployments.createOrUpdate function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=someVar;]") >= 0, "deploymentsOutput should have been updated");
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });

    // it('createOrUpdate deployment should fail when bicep file contains error', (done) => {
    //     let tp = path.join(__dirname, 'createOrUpdate.js');
    //     process.env["csmFile"] = "CSMwithBicepWithError.bicep";
    //     process.env["csmParametersFile"] = "";
    //     let tr = new ttm.MockTestRunner(tp);
    //     tr.run();
    //     try {
    //         assert(!tr.succeeded, "Should have failed");
    //         assert(tr.stdout.indexOf("This declaration type is not recognized. Specify a parameter, variable, resource, or output declaration.") > 0, "should have printed the error message")
    //         assert(tr.stdout.indexOf("deployments.createOrUpdate is called") < 0, "deployments.createOrUpdate function should not have been called from azure-sdk");
    //         done();
    //     }
    //     catch (error) {
    //         console.log("STDERR", tr.stderr);
    //         console.log("STDOUT", tr.stdout);
    //         done(error);
    //     }
    // });
});
