import fs = require('fs');
import assert = require('assert');
import path = require('path');
import stream = require('stream');
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as shared from './TestShared';
import * as tl from 'azure-pipelines-task-lib';
import basecommand from '../src/basecommand';

class TestCommand extends basecommand {
    public getTool(): string {
        return process.execPath;
    }

    public login(): void { }

    public logout(): void { }
}

function createOutputStream(output: string[]): stream.Writable {
    return new stream.Writable({
        write(chunk, encoding, callback) {
            output.push(chunk.toString());
            callback();
        }
    });
}

describe("HelmDeployV1 Suite", function () {
    this.timeout(30000);

    before(async () => {
        process.env[shared.TestEnvVars.operatingSystem] = tl.osType().match(/^Win/) ? shared.OperatingSystems.Windows : shared.OperatingSystems.Other;
    });

    beforeEach(async () => {
        delete process.env[shared.TestEnvVars.namespace];
        delete process.env[shared.TestEnvVars.valueFile];
        delete process.env[shared.TestEnvVars.overrideValues];
        delete process.env[shared.TestEnvVars.updatedependency];
        delete process.env[shared.TestEnvVars.caFile];
        delete process.env[shared.TestEnvVars.certFile];
        delete process.env[shared.TestEnvVars.insecureSkipTlsVerify];
        delete process.env[shared.TestEnvVars.keyFile];
        delete process.env[shared.TestEnvVars.plainHttp];
        delete process.env[shared.isHelmV3orHigher];
        delete process.env[shared.isHelmV37];
        delete process.env[shared.TestEnvVars.releaseName];
        delete process.env[shared.TestEnvVars.waitForExecution];
        delete process.env[shared.TestEnvVars.arguments];
        delete process.env[shared.TestEnvVars.chartName];
        delete process.env[shared.TestEnvVars.chartPath];
        delete process.env[shared.TestEnvVars.chartPathForACR];
        delete process.env[shared.TestEnvVars.connectionType];
        delete process.env[shared.TestEnvVars.command];
        delete process.env[shared.TestEnvVars.chartType];
        delete process.env[shared.TestEnvVars.version];
    });

    after(async () => { });

    it("neutralizes a NODE_OPTIONS logging command rendered from Helm NOTES", async function () {
        const injectedNodeOptions = "--import=data:text/javascript;base64,Y29uc29sZS5sb2coJ2F0dGFjaycp";
        const externalOutput = [
            "Thank you for installing the chart.",
            `##vso[task.setvariable variable=NODE_OPTIONS]${injectedNodeOptions}`,
            "Run kubectl get pods to verify the installation."
        ].join("\n");
        const neutralizedCommand = `##_vso[task.setvariable variable=NODE_OPTIONS]${injectedNodeOptions}`;
        const executableCommand = `##vso[task.setvariable variable=NODE_OPTIONS]${injectedNodeOptions}`;
        const execOptions = {
            env: Object.assign({}, process.env, { HELM_TEST_EXTERNAL_OUTPUT: externalOutput })
        };
        const command = new TestCommand(true);

        const asyncDisplayedOutput: string[] = [];
        let asyncRawOutput = "";
        const asyncTool = command.createCommand();
        asyncTool.arg(["-e", "process.stdout.write(process.env.HELM_TEST_EXTERNAL_OUTPUT)"]);
        asyncTool.on("stdout", data => asyncRawOutput += data.toString());

        await command.execCommand(asyncTool, Object.assign({}, execOptions, { outStream: createOutputStream(asyncDisplayedOutput) }));

        const asyncDisplay = asyncDisplayedOutput.join("");
        assert(asyncDisplay.includes("Thank you for installing the chart."), "benign async NOTES output should remain");
        assert(asyncDisplay.includes("Run kubectl get pods to verify the installation."), "benign async instructions should remain");
        assert(asyncDisplay.includes(neutralizedCommand), "async NODE_OPTIONS logging command should be neutralized");
        assert(!asyncDisplay.includes(executableCommand), "async output should not expose the NODE_OPTIONS command to the agent");
        assert.strictEqual(asyncRawOutput, externalOutput, "async stdout events should preserve raw Helm output");

        const syncDisplayedOutput: string[] = [];
        const syncTool = command.createCommand();
        syncTool.arg(["-e", "process.stdout.write(process.env.HELM_TEST_EXTERNAL_OUTPUT)"]);

        const syncResult = command.execCommandSync(syncTool, Object.assign({}, execOptions, { outStream: createOutputStream(syncDisplayedOutput) }));

        const syncDisplay = syncDisplayedOutput.join("");
        assert(syncDisplay.includes("Thank you for installing the chart."), "benign sync NOTES output should remain");
        assert(syncDisplay.includes("Run kubectl get pods to verify the installation."), "benign sync instructions should remain");
        assert(syncDisplay.includes(neutralizedCommand), "sync NODE_OPTIONS logging command should be neutralized");
        assert(!syncDisplay.includes(executableCommand), "sync output should not expose the NODE_OPTIONS command to the agent");
        assert.strictEqual(syncResult.stdout, externalOutput, "sync result should preserve raw Helm output for helmOutput");
    });

    it("neutralizes indented artifact upload and pipeline control commands from Helm NOTES", function () {
        const externalCommands = [
            "  ##vso[task.setvariable variable=MARKER]PWNED_BY_CHART_NOTES",
            "  ##vso[artifact.upload containerfolder=proof;artifactname=helmproof]/agent/.credentials",
            "  ##vso[task.logissue type=error]INJECTED_ISSUE_FROM_CHART_NOTES"
        ];
        const externalOutput = [
            "NOTES:",
            "1. Get the application URL by running these commands:",
            ...externalCommands,
            "2. Verify that the application is running."
        ].join("\n");
        const displayedOutput: string[] = [];
        const command = new TestCommand(true);
        const tool = command.createCommand();
        tool.arg(["-e", "process.stdout.write(process.env.HELM_TEST_EXTERNAL_OUTPUT)"]);

        const result = command.execCommandSync(tool, {
            env: Object.assign({}, process.env, { HELM_TEST_EXTERNAL_OUTPUT: externalOutput }),
            outStream: createOutputStream(displayedOutput)
        });

        const display = displayedOutput.join("");
        assert(display.includes("NOTES:"), "Helm NOTES heading should remain");
        assert(display.includes("1. Get the application URL by running these commands:"), "benign Helm instructions should remain");
        externalCommands.forEach(externalCommand => {
            assert(!display.includes(externalCommand), `displayed output should not contain executable command: ${externalCommand}`);
            assert(display.includes(externalCommand.replace("##vso[", "##_vso[")), `command should be neutralized: ${externalCommand}`);
        });
        assert.strictEqual(result.stdout, externalOutput, "raw Helm output should remain available for helmOutput");
    });

    it("Run successfully with Helm install (version 3) with chart name", async function () {
        const tp = path.join(__dirname, "TestSetup.js");
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.install;
        process.env[shared.TestEnvVars.chartType] = shared.ChartTypes.Name;
        process.env[shared.TestEnvVars.chartName] = shared.testChartName;
        process.env[shared.TestEnvVars.version] = shared.testChartVersion;
        process.env[shared.TestEnvVars.releaseName] = shared.testReleaseName;
        process.env[shared.TestEnvVars.failOnStderr] = "true";
        process.env[shared.TestEnvVars.publishPipelineMetadata] = "true";
        process.env[shared.isHelmV3orHigher] = "true";

        await tr.runAsync();
        assert(tr.stdout.indexOf("changed mode of file") != -1, "Mode of kubeconfig file should have been changed to 600");
        assert(tr.stdout.indexOf("v3") != -1, "Helm version 3 should have been installed");
        assert(tr.stdout.indexOf("STATUS: deployed") != -1, `Release should have been created with NAME: ${shared.testReleaseName}`);
        assert(tr.stdout.indexOf(`DeploymentDetailsApiResponse: {"mockKey":"mockValue"}`) != -1, "Web response should have been received for pushing metadata to evidence store");
        assert(tr.succeeded, "task should have succeeded");
    });

    it("Run successfully with Helm install (version 3) with chart name when publishPipelineMetadata is set to false", async function () {
        const tp = path.join(__dirname, "TestSetup.js");
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.install;
        process.env[shared.TestEnvVars.chartType] = shared.ChartTypes.Name;
        process.env[shared.TestEnvVars.chartName] = shared.testChartName;
        process.env[shared.TestEnvVars.version] = shared.testChartVersion;
        process.env[shared.TestEnvVars.releaseName] = shared.testReleaseName;
        process.env[shared.TestEnvVars.failOnStderr] = "true";
        process.env[shared.TestEnvVars.publishPipelineMetadata] = "false";
        process.env[shared.isHelmV3orHigher] = "true";

        await tr.runAsync();
        assert(tr.stdout.indexOf("changed mode of file") != -1, "Mode of kubeconfig file should have been changed to 600");
        assert(tr.stdout.indexOf("v3") != -1, "Helm version 3 should have been installed");
        assert(tr.stdout.indexOf("STATUS: deployed") != -1, `Release should have been created with NAME: ${shared.testReleaseName}`);
        assert(tr.stdout.indexOf(`DeploymentDetailsApiResponse: {"mockKey":"mockValue"}`) == -1, "Web response should not have been received for pushing metadata to evidence store when publishPipelineMetadata is false");
        assert(tr.succeeded, "task should have succeeded");
    });

    it("Run successfully with Helm install (version 2) with chart name", async function () {
        const tp = path.join(__dirname, "TestSetup.js");
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.install;
        process.env[shared.TestEnvVars.chartType] = shared.ChartTypes.Name;
        process.env[shared.TestEnvVars.chartName] = shared.testChartName;
        process.env[shared.TestEnvVars.releaseName] = shared.testReleaseName;
        process.env[shared.TestEnvVars.failOnStderr] = "false";
        process.env[shared.TestEnvVars.publishPipelineMetadata] = "true";
        process.env[shared.TestEnvVars.namespace] = shared.testNamespace;

        await tr.runAsync();
        assert(tr.stdout.indexOf("v2") != -1, "Helm version 2 should have been installed");
        assert(tr.stdout.indexOf("STATUS: deployed") != -1, `Release should have been created with NAME: ${shared.testReleaseName}`);
        assert(tr.stdout.indexOf(`DeploymentDetailsApiResponse: {"mockKey":"mockValue"}`) != -1, "Web response should have been received for pushing metadata to evidence store");
        assert(tr.succeeded, "task should have succeeded");
    });

    it("Run successfully with Helm install (version 3) with chart path", async function () {
        const tp = path.join(__dirname, "TestSetup.js");
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.install;
        process.env[shared.TestEnvVars.chartType] = shared.ChartTypes.FilePath;
        process.env[shared.TestEnvVars.chartPath] = shared.testChartPath;
        process.env[shared.TestEnvVars.releaseName] = shared.testReleaseName;
        process.env[shared.TestEnvVars.failOnStderr] = "false";
        process.env[shared.TestEnvVars.publishPipelineMetadata] = "true";
        process.env[shared.isHelmV3orHigher] = "true";

        await tr.runAsync();
        assert(tr.stdout.indexOf("v3") != -1, "Helm version 3 should have been installed");
        assert(tr.stdout.indexOf("STATUS: deployed") != -1, `Release should have been created with NAME: ${shared.testReleaseName}`);
        assert(tr.stdout.indexOf(`DeploymentDetailsApiResponse: {"mockKey":"mockValue"}`) != -1, "Web response should have been received for pushing metadata to evidence store");
        assert(tr.succeeded, "task should have succeeded");
    });

    it("Run successfully with Helm install (version 3) when release name is not given", async function () {
        const tp = path.join(__dirname, "TestSetup.js");
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.install;
        process.env[shared.TestEnvVars.chartType] = shared.ChartTypes.Name;
        process.env[shared.TestEnvVars.chartName] = shared.testChartName;
        process.env[shared.TestEnvVars.failOnStderr] = "false";
        process.env[shared.TestEnvVars.publishPipelineMetadata] = "true";
        process.env[shared.isHelmV3orHigher] = "true";

        await tr.runAsync();
        assert(tr.stdout.indexOf("v3") != -1, "Helm version 3 should have been installed");
        assert(tr.stdout.indexOf("STATUS: deployed") != -1, "Release should have been created");
        assert(tr.stdout.indexOf(`DeploymentDetailsApiResponse: {"mockKey":"mockValue"}`) != -1, "Web response should have been received for pushing metadata to evidence store");
        assert(tr.succeeded, "task should have succeeded");
    });

    it("Run successfully with Helm install (version 3) when invalid chart version is given", async function () {
        const tp = path.join(__dirname, "TestSetup.js");
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.install;
        process.env[shared.TestEnvVars.chartType] = shared.ChartTypes.Name;
        process.env[shared.TestEnvVars.chartName] = shared.testChartName;
        process.env[shared.TestEnvVars.version] = "abcd";
        process.env[shared.TestEnvVars.failOnStderr] = "false";
        process.env[shared.TestEnvVars.publishPipelineMetadata] = "true";
        process.env[shared.isHelmV3orHigher] = "true";

        await tr.runAsync();
        assert(tr.stdout.indexOf("v3") != -1, "Helm version 3 should have been installed");
        assert(tr.stdout.indexOf("STATUS: deployed") != -1, "Release should have been created");
        assert(tr.stdout.indexOf("The given version " + process.env[shared.TestEnvVars.version] + " is not valid. Running the helm install command with latest version") != -1, "Version should not have been accepted");
        assert(tr.stdout.indexOf(`DeploymentDetailsApiResponse: {"mockKey":"mockValue"}`) != -1, "Web response should have been received for pushing metadata to evidence store");
        assert(tr.succeeded, "task should have succeeded");
    });

    it("Run successfully with Helm upgrade (version 3) when chart name is given and release name is not", async function () {
        const tp = path.join(__dirname, "TestSetup.js");
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.upgrade;
        process.env[shared.TestEnvVars.chartType] = shared.ChartTypes.Name;
        process.env[shared.TestEnvVars.chartName] = shared.testChartName;
        process.env[shared.TestEnvVars.failOnStderr] = "false";
        process.env[shared.TestEnvVars.publishPipelineMetadata] = "true";
        process.env[shared.isHelmV3orHigher] = "true";

        await tr.runAsync();
        assert(tr.stdout.indexOf(`Release "${shared.testReleaseName}" has been upgraded`) != -1, "Release should have been upgraded");
        assert(tr.stdout.indexOf(`DeploymentDetailsApiResponse: {"mockKey":"mockValue"}`) != -1, "Web response should have been received for pushing metadata to evidence store");
        assert(tr.succeeded, "task should have succeeded");
    });

    it("Run successfully with Helm upgrade (version 3) when chart name and release name are given", async function () {
        const tp = path.join(__dirname, "TestSetup.js");
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.upgrade;
        process.env[shared.TestEnvVars.chartType] = shared.ChartTypes.Name;
        process.env[shared.TestEnvVars.chartName] = shared.testChartName;
        process.env[shared.TestEnvVars.releaseName] = shared.testReleaseName;
        process.env[shared.TestEnvVars.failOnStderr] = "false";
        process.env[shared.TestEnvVars.publishPipelineMetadata] = "true";
        process.env[shared.isHelmV3orHigher] = "true";

        await tr.runAsync();
        assert(tr.stdout.indexOf(`Release "${shared.testReleaseName}" has been upgraded`) != -1, "Release should have been upgraded");
        assert(tr.stdout.indexOf(`DeploymentDetailsApiResponse: {"mockKey":"mockValue"}`) != -1, "Web response  should have been received for pushing metadata to evidence store");
        assert(tr.succeeded, "task should have succeeded");
    });

    it("Run successfully with Helm init (version 2)", async function () {
        const tp = path.join(__dirname, "TestSetup.js");
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.init;
        process.env[shared.TestEnvVars.failOnStderr] = "false";

        await tr.runAsync();
        assert(tr.stdout.indexOf("$HELM_HOME has been configured") != -1, "Helm init should have run successfully");
        assert(tr.succeeded, "task should have succeeded");
    });

    it("Helm init should fail (version 3)", async function () {
        const tp = path.join(__dirname, "TestSetup.js");
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.init;
        process.env[shared.TestEnvVars.failOnStderr] = "false";
        process.env[shared.isHelmV3orHigher] = "true";

        await tr.runAsync();
        assert(tr.stdout.indexOf("Common actions for Helm:") != -1, "Available commands information should have been received");
        assert(tr.failed, "task should have failed");
    });

    it("Run successfully with Helm package command (version 3)", async function () {
        const tp = path.join(__dirname, "TestSetup.js");
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.package;
        process.env[shared.TestEnvVars.chartType] = shared.ChartTypes.FilePath;
        process.env[shared.TestEnvVars.chartPath] = shared.testChartPath;
        process.env[shared.TestEnvVars.destination] = shared.testDestinationPath;
        process.env[shared.TestEnvVars.failOnStderr] = "false";
        process.env[shared.isHelmV37] = "true";

        await tr.runAsync();
        assert(tr.stdout.indexOf(`Successfully packaged chart and saved it to: ${shared.testDestinationPath}/testChartName.tgz`) != -1, "Chart should have been successfully packaged");
        assert(tr.succeeded, "task should have succeeded");
    });

    it("Run successfully with Helm uninstall command with arguments", async function () {
        const tp = path.join(__dirname, "TestSetup.js");
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.uninstall;
        process.env[shared.TestEnvVars.releaseName] = shared.testReleaseName;
        process.env[shared.TestEnvVars.arguments] = "--ignore-not-found";
        process.env[shared.TestEnvVars.failOnStderr] = "false";
        process.env[shared.isHelmV3orHigher] = "true";

        await tr.runAsync();
        assert(tr.stdout.indexOf(`release "${shared.testReleaseName}" uninstalled`) != -1, "Release should have been uninstalled");
        assert(tr.stdout.indexOf("--ignore-not-found") != -1, "Arguments should have been passed to uninstall command");
        assert(tr.succeeded, "task should have succeeded");
    });

    it("Run successfully with Helm uninstall command without arguments", async function () {
        const tp = path.join(__dirname, "TestSetup.js");
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.uninstall;
        process.env[shared.TestEnvVars.releaseName] = shared.testReleaseName;
        process.env[shared.TestEnvVars.failOnStderr] = "false";
        process.env[shared.isHelmV3orHigher] = "true";

        await tr.runAsync();
        assert(tr.stdout.indexOf(`release "${shared.testReleaseName}" uninstalled`) != -1, "Release should have been uninstalled");
        assert(tr.succeeded, "task should have succeeded");
    });

    it("Run successfully with Helm uninstall command with namespace and arguments", async function () {
        const tp = path.join(__dirname, "TestSetup.js");
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.uninstall;
        process.env[shared.TestEnvVars.releaseName] = shared.testReleaseName;
        process.env[shared.TestEnvVars.namespace] = shared.testNamespace;
        process.env[shared.TestEnvVars.arguments] = "--ignore-not-found";
        process.env[shared.TestEnvVars.failOnStderr] = "false";
        process.env[shared.isHelmV3orHigher] = "true";

        await tr.runAsync();
        assert(tr.stdout.indexOf(`release "${shared.testReleaseName}" uninstalled`) != -1, "Release should have been uninstalled");
        assert(tr.stdout.indexOf("--ignore-not-found") != -1, "Arguments should have been passed to uninstall command");
        assert(tr.succeeded, "task should have succeeded");
    });

    // NEW TESTS: Testing feature flag behavior
    it("Run with feature flag OFF - uses legacy helm version command (--client --short)", async function () {
        const tp = path.join(__dirname, "TestSetup.js");
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        // Set feature flag to FALSE before running the test
        process.env['DISTRIBUTEDTASK_TASKS_USEHELMVERSIONV3ORHIGHER'] = 'false';
        
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.install;
        process.env[shared.TestEnvVars.chartType] = shared.ChartTypes.Name;
        process.env[shared.TestEnvVars.chartName] = shared.testChartName;
        process.env[shared.TestEnvVars.version] = shared.testChartVersion;
        process.env[shared.TestEnvVars.releaseName] = shared.testReleaseName;
        process.env[shared.TestEnvVars.failOnStderr] = "true";
        process.env[shared.TestEnvVars.publishPipelineMetadata] = "true";
        process.env[shared.isHelmV3orHigher] = "true";

        await tr.runAsync();
        // Task will read feature flag and use "helm version --client --short"
        assert(tr.succeeded, "task should have succeeded with feature flag OFF");
    });

    it("Run with feature flag ON - uses new helm version command (--short only)", async function () {
        const tp = path.join(__dirname, "TestSetup.js");  // SAME setup file!
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        // Set feature flag to TRUE before running the test
        process.env['DISTRIBUTEDTASK_TASKS_USEHELMVERSIONV3ORHIGHER'] = 'true';
        
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.install;
        process.env[shared.TestEnvVars.chartType] = shared.ChartTypes.Name;
        process.env[shared.TestEnvVars.chartName] = shared.testChartName;
        process.env[shared.TestEnvVars.version] = shared.testChartVersion;
        process.env[shared.TestEnvVars.releaseName] = shared.testReleaseName;
        process.env[shared.TestEnvVars.failOnStderr] = "true";
        process.env[shared.TestEnvVars.publishPipelineMetadata] = "true";
        process.env[shared.isHelmV3orHigher] = "true";

        await tr.runAsync();
        // Task will read feature flag and use "helm version --short" (without --client)
        assert(tr.succeeded, "task should have succeeded with feature flag ON");
    });
});