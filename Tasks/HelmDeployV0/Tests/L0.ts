import fs = require('fs');
import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as shared from './TestShared';
import * as tl from 'azure-pipelines-task-lib';

describe("HelmDeployV0 Suite", function () {
    this.timeout(30000);

    before((done) => {
        process.env[shared.TestEnvVars.operatingSystem] = tl.osType().match(/^Win/) ? shared.OperatingSystems.Windows : shared.OperatingSystems.Other;
        done();
    });

    beforeEach(() => {
        delete process.env[shared.TestEnvVars.namespace];
        delete process.env[shared.TestEnvVars.valueFile];
        delete process.env[shared.TestEnvVars.overrideValues];
        delete process.env[shared.TestEnvVars.updatedependency];
        delete process.env[shared.isHelmV3];
        delete process.env[shared.TestEnvVars.releaseName];
        delete process.env[shared.TestEnvVars.waitForExecution];
        delete process.env[shared.TestEnvVars.arguments];
        delete process.env[shared.TestEnvVars.chartName];
        delete process.env[shared.TestEnvVars.chartPath];
        delete process.env[shared.TestEnvVars.connectionType];
        delete process.env[shared.TestEnvVars.command];
        delete process.env[shared.TestEnvVars.chartType];
        delete process.env[shared.TestEnvVars.version];
    });

    after((done) => {
        done();
    });

    it("Run successfully with Helm install (version 3) with chart name", function (done: Mocha.Done) {
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
        process.env[shared.isHelmV3] = "true";
        process.env[shared.TestEnvVars.updatedependency] = "true";

        tr.run();
        assert(tr.stdout.indexOf("changed mode of file") != -1, "Mode of kubeconfig file should have been changed to 600");
        assert(tr.stdout.indexOf("v3") != -1, "Helm version 3 should have been installed");
        assert(tr.stdout.indexOf("STATUS: deployed") != -1, `Release should have been created with NAME: ${shared.testReleaseName}`);
        assert(tr.stdout.indexOf(`DeploymentDetailsApiResponse: {"mockKey":"mockValue"}`) != -1, "Web response should have been received for pushing metadata to evidence store");
        assert(tr.succeeded, "task should have succeeded");
        done();
    });

    it("Run successfully with Helm install (version 3) with chart name when publishPipelineMetadata is set to false", function (done: Mocha.Done) {
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
        process.env[shared.isHelmV3] = "true";

        tr.run();
        assert(tr.stdout.indexOf("changed mode of file") != -1, "Mode of kubeconfig file should have been changed to 600");
        assert(tr.stdout.indexOf("v3") != -1, "Helm version 3 should have been installed");
        assert(tr.stdout.indexOf("STATUS: deployed") != -1, `Release should have been created with NAME: ${shared.testReleaseName}`);
        assert(tr.stdout.indexOf(`DeploymentDetailsApiResponse: {"mockKey":"mockValue"}`) == -1, "Web response should not have been received for pushing metadata to evidence store when publishPipelineMetadata is false");
        assert(tr.succeeded, "task should have succeeded");
        done();
    });

    it("Run successfully with Helm install (version 2) with chart name", function (done: Mocha.Done) {
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

        tr.run();
        assert(tr.stdout.indexOf("v2") != -1, "Helm version 2 should have been installed");
        assert(tr.stdout.indexOf("STATUS: deployed") != -1, `Release should have been created with NAME: ${shared.testReleaseName}`);
        assert(tr.stdout.indexOf(`DeploymentDetailsApiResponse: {"mockKey":"mockValue"}`) != -1, "Web response should have been received for pushing metadata to evidence store");
        assert(tr.succeeded, "task should have succeeded");
        done();
    });

    it("Run successfully with Helm install (version 3) with chart path", function (done: Mocha.Done) {
        const tp = path.join(__dirname, "TestSetup.js");
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.install;
        process.env[shared.TestEnvVars.chartType] = shared.ChartTypes.FilePath;
        process.env[shared.TestEnvVars.chartPath] = shared.testChartPath;
        process.env[shared.TestEnvVars.releaseName] = shared.testReleaseName;
        process.env[shared.TestEnvVars.failOnStderr] = "false";
        process.env[shared.TestEnvVars.publishPipelineMetadata] = "true";
        process.env[shared.isHelmV3] = "true";

        tr.run();
        assert(tr.stdout.indexOf("v3") != -1, "Helm version 3 should have been installed");
        assert(tr.stdout.indexOf("STATUS: deployed") != -1, `Release should have been created with NAME: ${shared.testReleaseName}`);
        assert(tr.stdout.indexOf(`DeploymentDetailsApiResponse: {"mockKey":"mockValue"}`) != -1, "Web response should have been received for pushing metadata to evidence store");
        assert(tr.succeeded, "task should have succeeded");
        done();
    });

    it("Run successfully with Helm install (version 3) when release name is not given", function (done: Mocha.Done) {
        const tp = path.join(__dirname, "TestSetup.js");
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.install;
        process.env[shared.TestEnvVars.chartType] = shared.ChartTypes.Name;
        process.env[shared.TestEnvVars.chartName] = shared.testChartName;
        process.env[shared.TestEnvVars.failOnStderr] = "false";
        process.env[shared.TestEnvVars.publishPipelineMetadata] = "true";
        process.env[shared.isHelmV3] = "true";

        tr.run();
        assert(tr.stdout.indexOf("v3") != -1, "Helm version 3 should have been installed");
        assert(tr.stdout.indexOf("STATUS: deployed") != -1, "Release should have been created");
        assert(tr.stdout.indexOf(`DeploymentDetailsApiResponse: {"mockKey":"mockValue"}`) != -1, "Web response should have been received for pushing metadata to evidence store");
        assert(tr.succeeded, "task should have succeeded");
        done();
    });

    it("Run successfully with Helm install (version 3) when invalid chart version is given", function (done: Mocha.Done) {
        const tp = path.join(__dirname, "TestSetup.js");
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.install;
        process.env[shared.TestEnvVars.chartType] = shared.ChartTypes.Name;
        process.env[shared.TestEnvVars.chartName] = shared.testChartName;
        process.env[shared.TestEnvVars.version] = "abcd";
        process.env[shared.TestEnvVars.failOnStderr] = "false";
        process.env[shared.TestEnvVars.publishPipelineMetadata] = "true";
        process.env[shared.isHelmV3] = "true";

        tr.run();
        assert(tr.stdout.indexOf("v3") != -1, "Helm version 3 should have been installed");
        assert(tr.stdout.indexOf("STATUS: deployed") != -1, "Release should have been created");
        assert(tr.stdout.indexOf("The given version " + process.env[shared.TestEnvVars.version] + " is not valid. Running the helm install command with latest version") != -1, "Version should not have been accepted");
        assert(tr.stdout.indexOf(`DeploymentDetailsApiResponse: {"mockKey":"mockValue"}`) != -1, "Web response should have been received for pushing metadata to evidence store");
        assert(tr.succeeded, "task should have succeeded");
        done();
    });

    it("Run successfully with Helm upgrade (version 3) when chart name is given and release name is not", function (done: Mocha.Done) {
        const tp = path.join(__dirname, "TestSetup.js");
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.upgrade;
        process.env[shared.TestEnvVars.chartType] = shared.ChartTypes.Name;
        process.env[shared.TestEnvVars.chartName] = shared.testChartName;
        process.env[shared.TestEnvVars.failOnStderr] = "false";
        process.env[shared.TestEnvVars.publishPipelineMetadata] = "true";
        process.env[shared.isHelmV3] = "true";

        tr.run();
        assert(tr.stdout.indexOf(`Release "${shared.testReleaseName}" has been upgraded`) != -1, "Release should have been upgraded");
        assert(tr.stdout.indexOf(`DeploymentDetailsApiResponse: {"mockKey":"mockValue"}`) != -1, "Web response should have been received for pushing metadata to evidence store");
        assert(tr.succeeded, "task should have succeeded");
        done();
    });

    it("Run successfully with Helm upgrade (version 3) when chart name and release name are given", function (done: Mocha.Done) {
        const tp = path.join(__dirname, "TestSetup.js");
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.upgrade;
        process.env[shared.TestEnvVars.chartType] = shared.ChartTypes.Name;
        process.env[shared.TestEnvVars.chartName] = shared.testChartName;
        process.env[shared.TestEnvVars.releaseName] = shared.testReleaseName;
        process.env[shared.TestEnvVars.failOnStderr] = "false";
        process.env[shared.TestEnvVars.publishPipelineMetadata] = "true";
        process.env[shared.isHelmV3] = "true";

        tr.run();
        assert(tr.stdout.indexOf(`Release "${shared.testReleaseName}" has been upgraded`) != -1, "Release should have been upgraded");
        assert(tr.stdout.indexOf(`DeploymentDetailsApiResponse: {"mockKey":"mockValue"}`) != -1, "Web response  should have been received for pushing metadata to evidence store");
        assert(tr.succeeded, "task should have succeeded");
        done();
    });

    it("Run successfully with Helm init (version 2)", function (done: Mocha.Done) {
        const tp = path.join(__dirname, "TestSetup.js");
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.init;
        process.env[shared.TestEnvVars.failOnStderr] = "false";

        tr.run();
        assert(tr.stdout.indexOf("$HELM_HOME has been configured") != -1, "Helm init should have run successfully");
        assert(tr.succeeded, "task should have succeeded");
        done();
    });

    it("Helm init should fail (version 3)", function (done: Mocha.Done) {
        const tp = path.join(__dirname, "TestSetup.js");
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.init;
        process.env[shared.TestEnvVars.failOnStderr] = "false";
        process.env[shared.isHelmV3] = "true";

        tr.run();
        assert(tr.stdout.indexOf("Common actions for Helm:") != -1, "Available commands information should have been received");
        assert(tr.failed, "task should have failed");
        done();
    });

    it("Run successfully with Helm package command (version 3)", function (done: Mocha.Done) {
        const tp = path.join(__dirname, "TestSetup.js");
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.package;
        process.env[shared.TestEnvVars.chartType] = shared.ChartTypes.FilePath;
        process.env[shared.TestEnvVars.chartPath] = shared.testChartPath;
        process.env[shared.TestEnvVars.destination] = shared.testDestinationPath;
        process.env[shared.TestEnvVars.failOnStderr] = "false";
        process.env[shared.isHelmV3] = "true";
        process.env[shared.TestEnvVars.updatedependency] = "true";

        tr.run();
        assert(tr.stdout.indexOf(`Successfully packaged chart and saved it to: ${shared.testDestinationPath}/testChartName.tgz`) != -1, "Chart should have been successfully packaged");
        assert(tr.succeeded, "task should have succeeded");
        done();
    });

    it("Run successfully with Helm save command (version 3)", function (done: Mocha.Done) {
        const tp = path.join(__dirname, "TestSetup.js");
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.save;
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.None;
        process.env[shared.TestEnvVars.chartPathForACR] = shared.testChartPathForACR;
        process.env[shared.TestEnvVars.chartNameForACR] = shared.testChartNameForACR;
        process.env[shared.TestEnvVars.azureSubscriptionEndpointForACR] = shared.testAzureSubscriptionEndpointForACR;
        process.env[shared.TestEnvVars.azureResourceGroupForACR] = shared.testAzureResourceGroupForACR;
        process.env[shared.TestEnvVars.azureContainerRegistry] = shared.testAzureContainerRegistry;
        process.env[shared.TestEnvVars.failOnStderr] = "false";
        process.env[shared.isHelmV3] = "true";

        tr.run();
        assert(tr.stdout.indexOf("Successfully saved the helm chart to local registry cache.") != -1, "Chart should have been successfully saved to local registry cache.");
        assert(tr.stdout.indexOf(`Successfully logged in to  ${process.env[shared.TestEnvVars.azureContainerRegistry]}.`) != -1, "Azure container registry login should have been successful.");
        assert(tr.stdout.indexOf("Successfully pushed to the chart to container registry.") != -1, "Chart should have been successfully pushed to container registry.");
        assert(tr.stdout.indexOf("Successfully removed the chart from local cache.") != -1, "Chart should have been successfully removed from local cache.");
        assert(tr.succeeded, "task should have succeeded");
        done();
    });

    it("Helm same should fail (version 2)", function (done: Mocha.Done) {
        const tp = path.join(__dirname, "TestSetup.js");
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.save;
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.None;
        process.env[shared.TestEnvVars.chartPathForACR] = shared.testChartPathForACR;
        process.env[shared.TestEnvVars.chartNameForACR] = shared.testChartNameForACR;
        process.env[shared.TestEnvVars.azureSubscriptionEndpointForACR] = shared.testAzureSubscriptionEndpointForACR;
        process.env[shared.TestEnvVars.azureResourceGroupForACR] = shared.testAzureResourceGroupForACR;
        process.env[shared.TestEnvVars.azureContainerRegistry] = shared.testAzureContainerRegistry;
        process.env[shared.TestEnvVars.failOnStderr] = "false";

        tr.run();
        assert(tr.failed, "task should have failed");
        assert(tr.stdout.indexOf("loc_mock_SaveSupportedInHelmsV3Only") != -1, "Chart save should have failed when helm version is not 3.");
        done();
    })
});
