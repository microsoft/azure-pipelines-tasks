'use strict';

const assert = require('assert');
const ttm = require('azure-pipelines-task-lib/mock-test');
const path = require('path');
import fs = require("fs");

import { runSanitizeTests } from './sanitizeTests';
import { runAgentCompatibilityTests } from './agentCompatibilityTests';
import { parseAgentCommands, tryParseAgentCommand } from './agentCommandParser';

function setResponseFile(name) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('Azure Resource Manager Template Deployment', function () {
    this.timeout(120000);

    describe('Logging command sanitization', runSanitizeTests);
    describe('Agent compatibility', runAgentCompatibilityTests);

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
        process.env["agentVersion"] = "2.181.2";
        process.env["DECODE_PERCENTS"] = "false";
        let tr = new ttm.MockTestRunner(tp);
        try {
            await tr.runAsync();
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("properly sanitized") > 0, "Parameters should have been sanitized");
            assert(tr.stdout.indexOf("deployments.createOrUpdate is called") > 0, "deployments.createOrUpdate function should have been called from azure-sdk");
            assert(tr.stdout.indexOf('##vso[task.setvariable variable=someVar.safeOutput.type;]"string"') >= 0, "individual deploymentOutput should use the legacy command format");
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=someVar;]") >= 0, "deploymentsOutput should have been updated");
            assert(tr.stdout.indexOf("loc_mock_SafeOutputVariablesAgentTooOld") < 0, "the disabled feature should not check the agent version");
            assert(tr.stdout.indexOf("loc_mock_SafeOutputVariablesPercentDecodingDisabled") < 0, "the disabled feature should not check percent decoding");
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            throw error;
        }
        finally {
            delete process.env["regularDeploymentOutputs"];
            delete process.env["DISTRIBUTEDTASK_TASKS_ENABLESAFEARMDEPLOYMENTOUTPUTVARIABLES"];
            delete process.env["agentVersion"];
            delete process.env["DECODE_PERCENTS"];
        }
    });
    it('Warns when the aggregate deployment output name changes under the safe format', async () => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        process.env["deploymentOutputs"] = "a]b";
        process.env["DISTRIBUTEDTASK_TASKS_ENABLESAFEARMDEPLOYMENTOUTPUTVARIABLES"] = "true";
        let tr = new ttm.MockTestRunner(tp);
        try {
            await tr.runAsync();
            assert(tr.succeeded, "Should have succeeded");
            const emitted = tr.stdout.split(/\r?\n/)
                .filter(line => line.indexOf("##vso[task.setvariable variable=a%5Db;]{}") >= 0)[0];
            assert(emitted, "expected the aggregate output variable to use the safe format");
            const parsed = tryParseAgentCommand(emitted);
            assert(parsed, "the aggregate output command should parse");
            assert.strictEqual(parsed.properties.variable, "a]b", "the aggregate name should round-trip intact");
            assert.strictEqual(parsed.data, "{}", "the empty outputs object should be preserved");
            const warned = parseAgentCommands(tr.stdout)
                .filter(cmd => cmd.area + '.' + cmd.event === "task.issue" && cmd.properties.type === "warning");
            assert(
                warned.some(cmd => cmd.data.indexOf("loc_mock_OutputVariableNameChanged a]b") >= 0),
                "expected a warning naming the changed aggregate output variable");
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            throw error;
        }
        finally {
            delete process.env["DISTRIBUTEDTASK_TASKS_ENABLESAFEARMDEPLOYMENTOUTPUTVARIABLES"];
        }
    });
    it('Round-trips literal percent characters in output names and values', async () => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        process.env["deploymentOutputs"] = "someVar";
        process.env["percentDeploymentOutputs"] = "true";
        process.env["DISTRIBUTEDTASK_TASKS_ENABLESAFEARMDEPLOYMENTOUTPUTVARIABLES"] = "true";
        let tr = new ttm.MockTestRunner(tp);
        try {
            await tr.runAsync();
            assert(tr.succeeded, "Should have succeeded");
            const emitted = tr.stdout.split(/\r?\n/)
                .filter(line => line.indexOf("variable=someVar.percent%AZP25name.value;]") >= 0)[0];
            assert(emitted, "expected literal percent characters to be escaped during transport");
            const parsed = tryParseAgentCommand(emitted);
            assert(parsed, "the percent output command should parse");
            assert.strictEqual(parsed.properties.variable, "someVar.percent%name.value", "the percent in the name should round-trip");
            assert.strictEqual(parsed.data, '"https://host/a%20b"', "the percent in the value should round-trip");
            assert(tr.stdout.indexOf("loc_mock_OutputVariableNameChanged") < 0, "an ordinary percent should not trigger a compatibility warning");
        }
        finally {
            delete process.env["percentDeploymentOutputs"];
            delete process.env["DISTRIBUTEDTASK_TASKS_ENABLESAFEARMDEPLOYMENTOUTPUTVARIABLES"];
        }
    });
    it('Preserves legacy unescape tokens literally and warns about the changed name', async () => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        process.env["deploymentOutputs"] = "someVar";
        process.env["legacyTokenDeploymentOutputs"] = "true";
        process.env["DISTRIBUTEDTASK_TASKS_ENABLESAFEARMDEPLOYMENTOUTPUTVARIABLES"] = "true";
        let tr = new ttm.MockTestRunner(tp);
        try {
            await tr.runAsync();
            assert(tr.succeeded, "Should have succeeded");
            const emitted = tr.stdout.split(/\r?\n/)
                .filter(line => line.indexOf("variable=someVar.a%AZP255Db.value;]") >= 0)[0];
            assert(emitted, "expected the leading percent in the legacy token to be escaped");
            const parsed = tryParseAgentCommand(emitted);
            assert(parsed, "the legacy-token output command should parse");
            assert.strictEqual(parsed.properties.variable, "someVar.a%5Db.value", "the token spelling in the name should remain literal");
            assert.strictEqual(parsed.data, '"value%3B%0D%0A%AZP25"', "token spellings in the value should remain literal");
            const warned = parseAgentCommands(tr.stdout)
                .filter(cmd => cmd.area + '.' + cmd.event === "task.issue" && cmd.properties.type === "warning");
            assert(warned.some(cmd => cmd.data.indexOf("someVar.a%5Db.value") >= 0), "expected a compatibility warning for the changed name");
        }
        finally {
            delete process.env["legacyTokenDeploymentOutputs"];
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
            const executed = parseAgentCommands(tr.stdout);
            const injected = executed.filter(cmd =>
                cmd.properties.variable === "INLINE_NAME_MARKER" || cmd.properties.variable === "INLINE_VALUE_MARKER");
            assert.strictEqual(injected.length, 0, "inline payload must not produce an executable logging command");
            // The informational log line is sanitized instead, which reduces the marker to a
            // single # so the agent's parser cannot see it.
            assert(
                tr.stdout.indexOf("loc_mock_AddedOutputVariable someVar.safe#vso[task.setvariable variable=INLINE_NAME_MARKER;]confirmed.type") >= 0,
                "inline payload should be neutralized in the informational log line");
            // Round-trip the emitted command through the agent's parser: the escaping has to
            // be lossless, and the payload has to come back as an inert variable name.
            const emitted = tr.stdout.split(/\r?\n/)
                .filter(line => line.indexOf("##vso[task.setvariable variable=someVar.safe") >= 0 && line.indexOf(".type;]") > 0)[0];
            assert(emitted, "expected a setvariable command for the payload output");
            const parsed = tryParseAgentCommand(emitted);
            assert(parsed, "the emitted line should parse as a command");
            assert.strictEqual(parsed.area + '.' + parsed.event, "task.setvariable", "only one command should be parsed from the line");
            assert.strictEqual(
                parsed.properties.variable,
                'someVar.safe##vso[task.setvariable variable=INLINE_NAME_MARKER;]confirmed.type',
                "output name should survive escaping unchanged");
            // The value travels as the command's data. useWithoutJSON is deliberately left
            // unset here, so this also pins the default JSON.stringify formatting: a change
            // in quoting would otherwise slip through the checks above unnoticed.
            const emittedValue = tr.stdout.split(/\r?\n/)
                .filter(line => line.indexOf("##vso[task.setvariable variable=someVar.safe") >= 0 && line.indexOf(".value;]") > 0)[0];
            assert(emittedValue, "expected a setvariable command for the payload output value");
            const parsedValue = tryParseAgentCommand(emittedValue);
            assert(parsedValue, "the emitted value line should parse as a command");
            assert.strictEqual(
                parsedValue.properties.variable,
                'someVar.safe##vso[task.setvariable variable=INLINE_NAME_MARKER;]confirmed.value',
                "output name should survive escaping unchanged on the value command");
            assert.strictEqual(
                parsedValue.data,
                '"harmless##vso[task.setvariable variable=INLINE_VALUE_MARKER;]confirmed"',
                "output value should round-trip as inert JSON data");
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
    it('Neutralizes a payload carried by a nested output key', async () => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        process.env["deploymentOutputs"] = "someVar";
        process.env["nestedPayloadDeploymentOutputs"] = "true";
        process.env["DISTRIBUTEDTASK_TASKS_ENABLESAFEARMDEPLOYMENTOUTPUTVARIABLES"] = "true";
        let tr = new ttm.MockTestRunner(tp);
        try {
            await tr.runAsync();
            assert(tr.succeeded, "Should have succeeded");
            // The recursive walk reaches keys below the output root, so a payload nested two
            // levels down has to be escaped on exactly the same terms as a top-level one.
            const executed = parseAgentCommands(tr.stdout);
            const injected = executed.filter(cmd => cmd.properties.variable === "NESTED_NAME_MARKER");
            assert.strictEqual(injected.length, 0, "nested payload must not produce an executable logging command");
            assert(
                tr.stdout.indexOf("variable=NESTED_NAME_MARKER%3B%5Dconfirmed;]") >= 0,
                "nested payload should be escaped in the logging command");
            assert(
                tr.stdout.indexOf("loc_mock_AddedOutputVariable someVar.safeParent.value.evil;] #vso[task.setvariable variable=NESTED_NAME_MARKER;]confirmed") >= 0,
                "nested payload should be neutralized in the informational log line");
            // The nested key must still round-trip to the exact name the template declared,
            // including the line break it contains.
            const emitted = tr.stdout.split(/\r?\n/)
                .filter(line => line.indexOf("##vso[task.setvariable variable=someVar.safeParent.value.evil") >= 0)[0];
            assert(emitted, "expected a setvariable command for the nested output");
            const parsed = tryParseAgentCommand(emitted);
            assert(parsed, "the emitted line should parse as a command");
            assert.strictEqual(
                parsed.properties.variable,
                'someVar.safeParent.value.evil;]\n##vso[task.setvariable variable=NESTED_NAME_MARKER;]confirmed',
                "nested output name should survive escaping unchanged");
            assert.strictEqual(parsed.data, '"nested-payload-value"', "nested output value should be preserved");
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            throw error;
        }
        finally {
            delete process.env["nestedPayloadDeploymentOutputs"];
            delete process.env["DISTRIBUTEDTASK_TASKS_ENABLESAFEARMDEPLOYMENTOUTPUTVARIABLES"];
        }
    });
    it('Pins the legacy truncation of an output name that contains a closing bracket', async () => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        process.env["deploymentOutputs"] = "someVar";
        process.env["bracketNameDeploymentOutputs"] = "true";
        delete process.env["DISTRIBUTEDTASK_TASKS_ENABLESAFEARMDEPLOYMENTOUTPUTVARIABLES"];
        let tr = new ttm.MockTestRunner(tp);
        try {
            await tr.runAsync();
            assert(tr.succeeded, "Should have succeeded");
            // With the feature disabled the command is hand-built, so a bracket inside the
            // name terminates it early: the agent sets a truncated variable and treats the
            // rest of the name as data. That is pre-existing behaviour, pinned here so the
            // difference the escaped path introduces stays visible during the rollout.
            const emitted = tr.stdout.split(/\r?\n/)
                .filter(line => line.indexOf("##vso[task.setvariable variable=someVar.a") >= 0 && line.indexOf("b.value") >= 0)[0];
            assert(emitted, "expected a setvariable command for the bracketed output value");
            const parsed = tryParseAgentCommand(emitted);
            assert(parsed, "the emitted line should parse as a command");
            assert.strictEqual(parsed.properties.variable, "someVar.a", "legacy name is truncated at the bracket");
            assert.strictEqual(parsed.data, 'b.value;]"bracket-value"', "the remainder of the name leaks into the data");
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            throw error;
        }
        finally {
            delete process.env["bracketNameDeploymentOutputs"];
        }
    });
    it('Preserves an output name that contains a closing bracket', async () => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        process.env["deploymentOutputs"] = "someVar";
        process.env["bracketNameDeploymentOutputs"] = "true";
        process.env["DISTRIBUTEDTASK_TASKS_ENABLESAFEARMDEPLOYMENTOUTPUTVARIABLES"] = "true";
        let tr = new ttm.MockTestRunner(tp);
        try {
            await tr.runAsync();
            assert(tr.succeeded, "Should have succeeded");
            // Escaping the bracket repairs the truncation above: the variable now carries the
            // name the template declared, and the value is no longer polluted by it. Callers
            // that referenced the truncated name will see it change once the flag is enabled.
            const emitted = tr.stdout.split(/\r?\n/)
                .filter(line => line.indexOf("##vso[task.setvariable variable=someVar.a%5Db.value") >= 0)[0];
            assert(emitted, "expected a setvariable command for the bracketed output value");
            const parsed = tryParseAgentCommand(emitted);
            assert(parsed, "the emitted line should parse as a command");
            assert.strictEqual(parsed.properties.variable, "someVar.a]b.value", "the bracketed name round-trips intact");
            assert.strictEqual(parsed.data, '"bracket-value"', "the value is no longer polluted by the name");
            // A name the legacy format would have truncated has to raise a migration warning,
            // so the rename is visible in the log during the staged rollout instead of
            // silently changing which variable downstream steps resolve.
            const warned = parseAgentCommands(tr.stdout)
                .filter(cmd => cmd.area + '.' + cmd.event === "task.issue" && cmd.properties.type === "warning");
            assert(
                warned.some(cmd => cmd.data.indexOf("someVar.a]b.value") >= 0),
                "expected a warning naming the changed output variable");
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            throw error;
        }
        finally {
            delete process.env["bracketNameDeploymentOutputs"];
            delete process.env["DISTRIBUTEDTASK_TASKS_ENABLESAFEARMDEPLOYMENTOUTPUTVARIABLES"];
        }
    });
    it('Keeps the previous format when the agent cannot decode percent escaping', async () => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        process.env["deploymentOutputs"] = "someVar";
        process.env["bracketNameDeploymentOutputs"] = "true";
        process.env["DISTRIBUTEDTASK_TASKS_ENABLESAFEARMDEPLOYMENTOUTPUTVARIABLES"] = "true";
        process.env["agentVersion"] = "2.183.0";
        let tr = new ttm.MockTestRunner(tp);
        try {
            await tr.runAsync();
            assert(tr.succeeded, "Should have succeeded");
            // An agent below 2.184.0 hands the caller the raw %AZP25 sequence instead of a '%',
            // so the task keeps the previous format rather than publishing a corrupted name.
            // The pipeline keeps working and the log explains why the safe format was skipped.
            const emitted = tr.stdout.split(/\r?\n/)
                .filter(line => line.indexOf("##vso[task.setvariable variable=someVar.a") >= 0 && line.indexOf("b.value") >= 0)[0];
            assert(emitted, "expected a setvariable command for the bracketed output value");
            const parsed = tryParseAgentCommand(emitted);
            assert(parsed, "the emitted line should parse as a command");
            assert.strictEqual(parsed.properties.variable, "someVar.a", "the previous format is still in use");
            const warned = parseAgentCommands(tr.stdout)
                .filter(cmd => cmd.area + '.' + cmd.event === "task.issue" && cmd.properties.type === "warning");
            assert(
                warned.some(cmd => cmd.data.indexOf("loc_mock_SafeOutputVariablesAgentTooOld") >= 0),
                "expected a warning naming the unsupported agent version");
            assert(
                !warned.some(cmd => cmd.data.indexOf("loc_mock_OutputVariableNameChanged") >= 0),
                "no rename warning applies while the previous format is in use");
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            throw error;
        }
        finally {
            delete process.env["bracketNameDeploymentOutputs"];
            delete process.env["DISTRIBUTEDTASK_TASKS_ENABLESAFEARMDEPLOYMENTOUTPUTVARIABLES"];
            delete process.env["agentVersion"];
        }
    });
    it('Keeps the previous format when percent decoding is turned off', async () => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        process.env["deploymentOutputs"] = "someVar";
        process.env["bracketNameDeploymentOutputs"] = "true";
        process.env["DISTRIBUTEDTASK_TASKS_ENABLESAFEARMDEPLOYMENTOUTPUTVARIABLES"] = "true";
        process.env["DECODE_PERCENTS"] = "false";
        let tr = new ttm.MockTestRunner(tp);
        try {
            await tr.runAsync();
            assert(tr.succeeded, "Should have succeeded");
            // A current agent still leaves %AZP25 alone when this variable turns decoding off,
            // so the same fallback applies.
            const emitted = tr.stdout.split(/\r?\n/)
                .filter(line => line.indexOf("##vso[task.setvariable variable=someVar.a") >= 0 && line.indexOf("b.value") >= 0)[0];
            assert(emitted, "expected a setvariable command for the bracketed output value");
            const parsed = tryParseAgentCommand(emitted);
            assert(parsed, "the emitted line should parse as a command");
            assert.strictEqual(parsed.properties.variable, "someVar.a", "the previous format is still in use");
            const warned = parseAgentCommands(tr.stdout)
                .filter(cmd => cmd.area + '.' + cmd.event === "task.issue" && cmd.properties.type === "warning");
            assert(
                warned.some(cmd => cmd.data.indexOf("loc_mock_SafeOutputVariablesPercentDecodingDisabled") >= 0),
                "expected a warning naming the variable that disabled decoding");
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            throw error;
        }
        finally {
            delete process.env["bracketNameDeploymentOutputs"];
            delete process.env["DISTRIBUTEDTASK_TASKS_ENABLESAFEARMDEPLOYMENTOUTPUTVARIABLES"];
            delete process.env["DECODE_PERCENTS"];
        }
    });
    it('Prioritizes the old-agent warning when both compatibility checks fail', async () => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSM.json";
        process.env["csmParametersFile"] = "CSM.json";
        process.env["deploymentOutputs"] = "someVar";
        process.env["regularDeploymentOutputs"] = "true";
        process.env["DISTRIBUTEDTASK_TASKS_ENABLESAFEARMDEPLOYMENTOUTPUTVARIABLES"] = "true";
        process.env["agentVersion"] = "2.183.0";
        process.env["DECODE_PERCENTS"] = "false";
        let tr = new ttm.MockTestRunner(tp);
        try {
            await tr.runAsync();
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf('##vso[task.setvariable variable=someVar.safeOutput.type;]"string"') >= 0, "the legacy format should be used");
            assert(tr.stdout.indexOf("loc_mock_SafeOutputVariablesAgentTooOld") >= 0, "the old-agent warning should be emitted");
            assert(tr.stdout.indexOf("loc_mock_SafeOutputVariablesPercentDecodingDisabled") < 0, "only the primary incompatibility warning should be emitted");
        }
        finally {
            delete process.env["regularDeploymentOutputs"];
            delete process.env["DISTRIBUTEDTASK_TASKS_ENABLESAFEARMDEPLOYMENTOUTPUTVARIABLES"];
            delete process.env["agentVersion"];
            delete process.env["DECODE_PERCENTS"];
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
            const normalizedOutput = tr.stdout.replace(/\\/g, '/');
            const expectedAzureCliPath = path.join(__dirname, "mock_node_modules", "azure-cli", "az").replace(/\\/g, '/');
            assert(normalizedOutput.indexOf(`${expectedAzureCliPath} bicep build`) > 0, "Should have used the resolved Azure CLI path");
            assert(normalizedOutput.indexOf(`${expectedAzureCliPath} login --service-principal`) > 0, "Should have used the resolved Azure CLI path for login");
            assert(normalizedOutput.indexOf(`${expectedAzureCliPath} account set`) > 0, "Should have used the resolved Azure CLI path for account setup");
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            throw error;
        }
    });

    it('uses legacy Azure CLI invocation when resolved path feature is disabled', async () => {
        let tp = path.join(__dirname, 'createOrUpdate.js');
        process.env["csmFile"] = "CSMwithBicep.bicep";
        process.env["csmParametersFile"] = "";
        process.env["TEST_USE_RESOLVED_AZURE_CLI_PATH_FEATURE_DISABLED"] = "true";
        let tr = new ttm.MockTestRunner(tp);
        try {
            await tr.runAsync();
            assert(tr.succeeded, "Should have succeeded");
            const normalizedOutput = tr.stdout.replace(/\\/g, '/');
            const expectedAzureCliPath = path.join(__dirname, "mock_node_modules", "azure-cli", "az").replace(/\\/g, '/');
            assert(normalizedOutput.indexOf("az bicep build") > 0, "Should have used the legacy Azure CLI invocation");
            assert(normalizedOutput.indexOf("az login --service-principal") > 0, "Should have used the legacy Azure CLI invocation for login");
            assert(normalizedOutput.indexOf(`${expectedAzureCliPath} bicep build`) < 0, "Should not have used the resolved Azure CLI path");
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            throw error;
        }
        finally {
            delete process.env["TEST_USE_RESOLVED_AZURE_CLI_PATH_FEATURE_DISABLED"];
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
