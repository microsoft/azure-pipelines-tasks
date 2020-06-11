import fs = require('fs');
import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as shared from './TestShared';
import * as tl from 'azure-pipelines-task-lib';

describe('HelmDeployV0 Suite', function () {
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
    });

    after((done) => {
        done();
    });

    it('Run successfully with Helm install (version 3) with chart name', function(done: MochaDone) {        
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.install;
        process.env[shared.TestEnvVars.chartType] = shared.ChartTypes.Name;
        process.env[shared.TestEnvVars.chartName] = shared.testChartName;
        process.env[shared.TestEnvVars.releaseName] = shared.testReleaseName;
        process.env[shared.TestEnvVars.failOnStderr] = 'ture';
        process.env[shared.isHelmV3] = 'true';

        tr.run();
        assert(tr.stdout.indexOf("v3") != -1, 'Helm version 3 installed');
        assert(tr.stdout.indexOf('STATUS: deployed') != -1, `Release created with NAME: ${shared.testReleaseName}`);
        assert(tr.stdout.indexOf('# Source: testChartName/templates/serviceaccount.yaml') != -1, `Manifests extracted from release ${shared.testReleaseName}`);
        assert(tr.stdout.indexOf('DeploymentDetailsApiResponse: {"mockKey":"mockValue"}') != -1, 'Web response for pushing metadata to evidence store');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('Run successfully with Helm install (version 2) with chart name', function(done: MochaDone) {        
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.install;
        process.env[shared.TestEnvVars.chartType] = shared.ChartTypes.Name;
        process.env[shared.TestEnvVars.chartName] = shared.testChartName;
        process.env[shared.TestEnvVars.releaseName] = shared.testReleaseName;
        process.env[shared.TestEnvVars.failOnStderr] = 'false';
        process.env[shared.TestEnvVars.namespace] = shared.testNamespace;

        tr.run();
        assert(tr.stdout.indexOf("v2") != -1, 'Helm version 2 installed');
        assert(tr.stdout.indexOf('STATUS: deployed') != -1, `Release created with NAME: ${shared.testReleaseName}`);
        assert(tr.stdout.indexOf('# Source: testChartName/templates/serviceaccount.yaml') != -1, `Manifests extracted from release ${shared.testReleaseName}`);
        assert(tr.stdout.indexOf('DeploymentDetailsApiResponse: {"mockKey":"mockValue"}') != -1, 'Web response for pushing metadata to evidence store');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('Run successfully with Helm install (version 3) with chart path', function(done: MochaDone) {        
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.install;
        process.env[shared.TestEnvVars.chartType] = shared.ChartTypes.FilePath;
        process.env[shared.TestEnvVars.chartPath] = shared.testChartPath;
        process.env[shared.TestEnvVars.releaseName] = shared.testReleaseName;
        process.env[shared.TestEnvVars.failOnStderr] = 'false';
        process.env[shared.isHelmV3] = 'true';

        tr.run();
        assert(tr.stdout.indexOf("v3") != -1, 'Helm version 3 installed');
        assert(tr.stdout.indexOf('STATUS: deployed') != -1, `Release created with NAME: ${shared.testReleaseName}`);
        assert(tr.stdout.indexOf('# Source: testChartName/templates/serviceaccount.yaml') != -1, `Manifests extracted from release ${shared.testReleaseName}`);
        assert(tr.stdout.indexOf('DeploymentDetailsApiResponse: {"mockKey":"mockValue"}') != -1, 'Web response for pushing metadata to evidence store');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('Run successfully with Helm install (version 3) when release name is not given', function(done: MochaDone) {        
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.install;
        process.env[shared.TestEnvVars.chartType] = shared.ChartTypes.Name;
        process.env[shared.TestEnvVars.chartName] = shared.testChartName;
        process.env[shared.TestEnvVars.failOnStderr] = 'false';
        process.env[shared.isHelmV3] = 'true';

        tr.run();
        assert(tr.stdout.indexOf("v3") != -1, 'Helm version 3 installed');
        assert(tr.stdout.indexOf('STATUS: deployed') != -1, `Release created`);
        assert(tr.stdout.indexOf('# Source: testChartName/templates/serviceaccount.yaml') != -1, `Manifests extracted from release ${shared.testReleaseName}`);
        assert(tr.stdout.indexOf('DeploymentDetailsApiResponse: {"mockKey":"mockValue"}') != -1, 'Web response for pushing metadata to evidence store');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('Run successfully with Helm upgrade (version 3) when chart name is given and release name is not', function(done: MochaDone) {        
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.upgrade;
        process.env[shared.TestEnvVars.chartType] = shared.ChartTypes.Name;
        process.env[shared.TestEnvVars.chartName] = shared.testChartName;
        process.env[shared.TestEnvVars.failOnStderr] = 'false';
        process.env[shared.isHelmV3] = 'true';

        tr.run();
        assert(tr.stdout.indexOf(`Release "${shared.testReleaseName}" has been upgraded`) != -1, `Release upgraded`);
        assert(tr.stdout.indexOf('# Source: testChartName/templates/serviceaccount.yaml') != -1, `Manifests extracted from release ${shared.testReleaseName}`);
        assert(tr.stdout.indexOf('DeploymentDetailsApiResponse: {"mockKey":"mockValue"}') != -1, 'Web response for pushing metadata to evidence store');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('Run successfully with Helm upgrade (version 3) when chart name and release name are given', function(done: MochaDone) {        
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.upgrade;
        process.env[shared.TestEnvVars.chartType] = shared.ChartTypes.Name;
        process.env[shared.TestEnvVars.chartName] = shared.testChartName;
        process.env[shared.TestEnvVars.releaseName] = shared.testReleaseName;
        process.env[shared.TestEnvVars.failOnStderr] = 'false';
        process.env[shared.isHelmV3] = 'true';
        
        tr.run();
        assert(tr.stdout.indexOf(`Release "${shared.testReleaseName}" has been upgraded`) != -1, `Release upgraded`);
        assert(tr.stdout.indexOf('# Source: testChartName/templates/serviceaccount.yaml') != -1, `Manifests extracted from release ${shared.testReleaseName}`);
        assert(tr.stdout.indexOf('DeploymentDetailsApiResponse: {"mockKey":"mockValue"}') != -1, 'Web response for pushing metadata to evidence store');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('Run successfully with Helm init (version 2)', function(done: MochaDone) {        
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.init;
        process.env[shared.TestEnvVars.failOnStderr] = 'false';

        tr.run();
        assert(tr.stdout.indexOf('$HELM_HOME has been configured') != -1, 'Helm init ran successfully');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('Helm init should fail (version 3)', function(done: MochaDone) {        
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.init;
        process.env[shared.TestEnvVars.failOnStderr] = 'false';
        process.env[shared.isHelmV3] = 'true';

        tr.run();
        assert(tr.failed, 'task should have failed');
        done();
    });

    it('Run successfully with Helm package command (version 3)', function(done: MochaDone) {        
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionTypes.KubernetesServiceConnection;
        process.env[shared.TestEnvVars.command] = shared.Commands.package;
        process.env[shared.TestEnvVars.chartType] = shared.ChartTypes.FilePath;
        process.env[shared.TestEnvVars.chartPath] = shared.testChartPath;
        process.env[shared.TestEnvVars.destination] = shared.testDestinationPath;
        process.env[shared.TestEnvVars.failOnStderr] = 'false';
        process.env[shared.isHelmV3] = 'true';
        
        tr.run();
        assert(tr.stdout.indexOf(`Successfully packaged chart and saved it to: ${shared.testDestinationPath}/testChartName.tgz`) !=-1 , 'Chart successfully packaged');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });    
});
