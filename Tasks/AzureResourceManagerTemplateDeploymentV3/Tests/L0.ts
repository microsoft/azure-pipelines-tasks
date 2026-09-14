'use strict';

const assert = require('assert');
const ttm = require('azure-pipelines-task-lib/mock-test');
const taskCommand = require('azure-pipelines-task-lib/taskcommand');
const path = require('path');
import fs = require("fs");

import { runSanitizeTests } from './sanitizeTests';

function setResponseFile(name) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('Azure Resource Manager Template Deployment', function () {
    this.timeout(120000);

    describe('Logging command sanitization', runSanitizeTests);

    before((done) => {
        done();
    });
    after(function () {
    });

    process.env['AGENT_HOMEDIRECTORY'] = process.env['AGENT_HOMEDIRECTORY'] || "C:\\temp\\agent\\home";
    if (!fs.existsSync(process.env['AGENT_HOMEDIRECTORY'])){
        fs.mkdirSync(process.env['AGENT_HOMEDIRECTORY']);
    }
	process.env['BUILD_SOURCESDIRECTORY'] = process.env['BUILD_SOURCESDIRECTORY'] || "C:\\temp\\agent\\home\\sources";
    if (!fs.existsSync(process.env['BUILD_SOURCESDIRECTORY'])){
        fs.mkdirSync(process.env['BUILD_SOURCESDIRECTORY']);
    }
	process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] || "C:\\temp\\agent\\home";
    if (!fs.existsSync(process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'])){
        fs.mkdirSync(process.env['SYSTEM_DEFAULTWORKINGDIRECTORY']);
    }
	process.env["AGENT_TEMPDIRECTORY"] = process.env["AGENT_TEMPDIRECTORY"] || "C:\\temp\\agent\\home\\temp";
    if (!fs.existsSync(process.env['AGENT_TEMPDIRECTORY'])){
        fs.mkdirSync(process.env['AGENT_TEMPDIRECTORY']);
    }

//  uncomment to get test traces
//	process.env['TASK_TEST_TRACE'] = "1";

    /*it('Successfully triggered createOrUpdate deployment', async () => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
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
            throw error;
        }
    });*/
    it('Preserves legacy deployment output commands when the feature flag is disabled', async () => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        process.env["deploymentOutputs"] = "someVar";
        process.env["regularDeploymentOutputs"] = "true";
        process.env["DISTRIBUTEDTASK_TASKS_ENABLESAFEARMDEPLOYMENTOUTPUTVARIABLES"] = "false";
        let tr = new ttm.MockTestRunner(tp);
        try {
            await tr.runAsync();
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("properly sanitized") > 0, "Parameters should have been sanitized");
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") > 0, "deployments.createOrUpdate function should have been called from azure-sdk");
            assert(tr.stdout.indexOf('##vso[task.setvariable variable=someVar.safeOutput.type;]"string"') >= 0, "individual deploymentOutput should use the legacy command format");
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=someVar;]") >= 0, "deploymentsOutput should have been updated");
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            throw error;
        }
        finally {
            delete process.env["regularDeploymentOutputs"];
            delete process.env["DISTRIBUTEDTASK_TASKS_ENABLESAFEARMDEPLOYMENTOUTPUTVARIABLES"];
        }
    });
    it('Escapes ARM output names before creating deployment output variables', async () => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        process.env["deploymentOutputs"] = "someVar";
        process.env["specialCharacterDeploymentOutputs"] = "true";
        process.env["useWithoutJSON"] = "true";
        process.env["DISTRIBUTEDTASK_TASKS_ENABLESAFEARMDEPLOYMENTOUTPUTVARIABLES"] = "true";
        let tr = new ttm.MockTestRunner(tp);
        try {
            await tr.runAsync();
            assert(tr.succeeded, "Should have succeeded");
            assert(
                tr.stdout.indexOf("variable=someVar.safe%3B%5D%0A##vso[task.setvariable variable=OUTPUT_VARIABLE_TEST_MARKER%3B%5Dconfirmed%0A##vso[task.setvariable variable=padding.type;") >= 0,
                "ARM output name should be escaped in the logging command");
            assert(
                tr.stdout.indexOf("\n##vso[task.setvariable variable=OUTPUT_VARIABLE_TEST_MARKER;]confirmed") < 0,
                "ARM output name should not inject a logging command");
            assert(
                tr.stdout.indexOf("loc_mock_AddedOutputVariable someVar.safe;] #vso[task.setvariable variable=OUTPUT_VARIABLE_TEST_MARKER;]confirmed #vso[task.setvariable variable=padding.type") >= 0,
                "ARM output name should be neutralized when included in informational logs");
            assert(
                tr.stdout.indexOf("harmless-marker%0A##vso[task.setvariable variable=OUTPUT_VALUE_TEST_MARKER;]confirmed") >= 0,
                "ARM output value should be escaped in the logging command");
            assert(
                tr.stdout.indexOf("\n##vso[task.setvariable variable=OUTPUT_VALUE_TEST_MARKER;]confirmed") < 0,
                "ARM output value should not inject a logging command");
            assert(
                tr.stdout.indexOf("##vso[task.setvariable variable=someVar;]") >= 0,
                "aggregate deploymentOutput should be updated");
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            throw error;
        }
        finally {
            delete process.env["specialCharacterDeploymentOutputs"];
            delete process.env["useWithoutJSON"];
            delete process.env["DISTRIBUTEDTASK_TASKS_ENABLESAFEARMDEPLOYMENTOUTPUTVARIABLES"];
        }
    });
    it('Neutralizes an inline payload that contains no line break', async () => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        process.env["deploymentOutputs"] = "someVar";
        process.env["inlinePayloadDeploymentOutputs"] = "true";
        process.env["DISTRIBUTEDTASK_TASKS_ENABLESAFEARMDEPLOYMENTOUTPUTVARIABLES"] = "true";
        let tr = new ttm.MockTestRunner(tp);
        try {
            await tr.runAsync();
            assert(tr.succeeded, "Should have succeeded");
            // The name keeps its ##vso[ text but loses the ; and ] that a command needs in
            // order to terminate, so the payload cannot close the surrounding command.
            assert(
                tr.stdout.indexOf("variable=someVar.safe##vso[task.setvariable variable=INLINE_NAME_MARKER%3B%5Dconfirmed.type;]") >= 0,
                "inline payload in the output name should be escaped in the logging command");
            // The agent honours the first marker on a line and treats the remainder as data,
            // so the property that matters is that no line parses into a command that sets
            // the payload's variables - not that the text never appears at all.
            const injected = tr.stdout.split('\n')
                .filter(line => line.indexOf("##vso[") >= 0)
                .map(line => {
                    try {
                        return taskCommand.commandFromString(line.substring(line.indexOf("##vso[")));
                    } catch (error) {
                        return null;
                    }
                })
                .filter(cmd => !!cmd && (cmd.properties.variable === "INLINE_NAME_MARKER" || cmd.properties.variable === "INLINE_VALUE_MARKER"));
            assert.strictEqual(injected.length, 0, "inline payload must not produce an executable logging command");
            // The informational log line is sanitized instead, which reduces the marker to a
            // single # so the agent's parser cannot see it.
            assert(
                tr.stdout.indexOf("loc_mock_AddedOutputVariable someVar.safe#vso[task.setvariable variable=INLINE_NAME_MARKER;]confirmed.type") >= 0,
                "inline payload should be neutralized in the informational log line");
            // Round-trip the emitted command through the agent's own parser: the escaping has
            // to be lossless, and the payload has to come back as an inert variable name.
            const emitted = tr.stdout.split('\n')
                .filter(line => line.indexOf("##vso[task.setvariable variable=someVar.safe") >= 0 && line.indexOf(".type;]") > 0)
                .map(line => line.substring(line.indexOf("##vso[")))[0];
            assert(emitted, "expected a setvariable command for the payload output");
            const parsed = taskCommand.commandFromString(emitted);
            assert.strictEqual(parsed.command, "task.setvariable", "only one command should be parsed from the line");
            assert.strictEqual(
                parsed.properties.variable,
                'someVar.safe##vso[task.setvariable variable=INLINE_NAME_MARKER;]confirmed.type',
                "output name should survive escaping unchanged");
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            throw error;
        }
        finally {
            delete process.env["inlinePayloadDeploymentOutputs"];
            delete process.env["DISTRIBUTEDTASK_TASKS_ENABLESAFEARMDEPLOYMENTOUTPUTVARIABLES"];
        }
    });
    it('Create or Update RG, failed on faulty CSM template file', async () => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "faultyCSM.json";
        process.env["csmParametersFile"] = "faultyCSM.json";
        let tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        try {
            assert(tr.failed, "Task should have failed");
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") == -1, "Task should have failed before calling deployments.createOrUpdate function from azure-sdk");
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            throw error;
        }
    });
    it('Create or Update RG, succeeded on CSM template file with comments', async () => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSMwithComments.json";
        process.env["csmParametersFile"] = "CSMwithComments.json";
        let tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        try {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") > 0, "deployments.createOrUpdate function should have been called from azure-sdk");
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            throw error;
        }
    });
    it('createOrUpdate deployment should fail when no template file is found', async () => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSMNotThere.json";
        process.env["csmParametersFile"] = "CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        try {
            assert(!tr.succeeded, "Should have failed");
            assert(tr.stdout.indexOf("TemplateFilePatternMatchingNoFile") > 0, "should have printed TemplateFilePatternMatchingNoFile")
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") < 0, "deployments.createOrUpdate function should not have been called from azure-sdk");
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            throw error;
        }
    });

    it('createOrUpdate deployment should fail when multiple template files are found', async () => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSMmultiple.json";
        process.env["csmParametersFile"] = "CSM.json";
        let tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        try {
            assert(!tr.succeeded, "Should have failed");
            assert(tr.stdout.indexOf("TemplateFilePatternMatchingMoreThanOneFile") > 0, "should have printed TemplateFilePatternMatchingMoreThanOneFile")
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") < 0, "deployments.createOrUpdate function should not have been called from azure-sdk");
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            throw error;
        }
    });

    it('createOrUpdate deployment should fail when no parameter file is found', async () => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSMNotThere.json";
        let tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        try {
            assert(!tr.succeeded, "Should have failed");
            assert(tr.stdout.indexOf("TemplateParameterFilePatternMatchingNoFile") > 0, "should have printed TemplateParameterFilePatternMatchingNoFile")
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") < 0, "deployments.createOrUpdate function should not have been called from azure-sdk");
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            throw error;
        }
    });

    it('createOrUpdate deployment should fail when multiple template files are found', async () => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSMmultiple.json";
        let tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        try {
            assert(!tr.succeeded, "Should have failed");
            assert(tr.stdout.indexOf("TemplateParameterFilePatternMatchingMoreThanOneFile") > 0, "should have printed TemplateFilePatternMatchingMoreThanOneFile")
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") < 0, "deployments.createOrUpdate function should not have been called from azure-sdk");
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            throw error;
        }
    });

    it('Successfully triggered createOrUpdate deployment using bicep file', async () => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSMwithBicep.bicep";
        process.env["csmParametersFile"] = "";
        process.env["deploymentOutputs"] = "someVar";
        let tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        try {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") > 0, "deployments.createOrUpdate function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=someVar;]") >= 0, "deploymentsOutput should have been updated");
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            throw error;
        }
    });

    it('Successfully triggered createOrUpdate deployment using bicep file with space in path', async () => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSMwithBicep WithSpaceInPath.bicep";
        process.env["csmParametersFile"] = "";
        process.env["deploymentOutputs"] = "someVar";
        let tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        try {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") > 0, "deployments.createOrUpdate function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=someVar;]") >= 0, "deploymentsOutput should have been updated");
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            throw error;
        }
    });

    it('Successfully triggered createOrUpdate deployment using bicep file with unused params', async () => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSMwithBicepWithWarning.bicep";
        process.env["csmParametersFile"] = "";
        process.env["deploymentOutputs"] = "someVar";
        let tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        try {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") > 0, "deployments.createOrUpdate function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=someVar;]") >= 0, "deploymentsOutput should have been updated");
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            throw error;
        }
    });

    it('Successfully triggered createOrUpdate deployment using bicep file with bicepparam file', async () => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSMwithBicep.bicep";
        process.env["csmParametersFile"] = "CSMwithBicep.bicepparam";
        process.env["deploymentOutputs"] = "someVar";
        let tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        try {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") > 0, "deployments.createOrUpdate function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=someVar;]") >= 0, "deploymentsOutput should have been updated");
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            throw error;
        }
    });

    it('Successfully triggered createOrUpdate deployment using bicep file with bicepparam file using multiple file extensions', async () => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSMwithBicep.bicep";
        process.env["csmParametersFile"] = "CSMwithBicep.prod.bicepparam";
        process.env["deploymentOutputs"] = "someVar";
        let tr = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        try {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") > 0, "deployments.createOrUpdate function should have been called from azure-sdk");
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=someVar;]") >= 0, "deploymentsOutput should have been updated");
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            throw error;
        }
    });

    // it('createOrUpdate deployment should fail when bicep file contains error', async () => {
    //     let tp = path.join(__dirname, 'createOrUpdate.js');
    //     process.env["csmFile"] = "CSMwithBicepWithError.bicep";
    //     process.env["csmParametersFile"] = "";
    //     let tr = new ttm.MockTestRunner(tp);
    //     await tr.runAsync();
    //     try {
    //         assert(!tr.succeeded, "Should have failed");
    //         assert(tr.stdout.indexOf("This declaration type is not recognized. Specify a parameter, variable, resource, or output declaration.") > 0, "should have printed the error message")
    //         assert(tr.stdout.indexOf("deployments.createOrUpdate is called") < 0, "deployments.createOrUpdate function should not have been called from azure-sdk");
    //         done();
    //     }
    //     catch (error) {
    //         console.log("STDERR", tr.stderr);
    //         console.log("STDOUT", tr.stdout);
    //         throw error;
    //     }
    // });
});
