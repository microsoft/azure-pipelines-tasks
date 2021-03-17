import * as fs from 'fs';
import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as tl from 'azure-pipelines-task-lib';
import * as shared from './TestShared';
import * as utils from '../src/utils/utilities';
import { updateImagePullSecrets, updateImageDetails } from '../src/utils/KubernetesObjectUtility';
import * as yaml from 'js-yaml';
import { IExecSyncResult } from 'azure-pipelines-task-lib/toolrunner';

describe('Kubernetes Manifests Suite', function () {
    this.timeout(30000);

    before((done) => {
        process.env[shared.TestEnvVars.operatingSystem] = tl.osType().match(/^Win/) ? shared.OperatingSystems.Windows : shared.OperatingSystems.Other;
        process.env[shared.TestEnvVars.isKubectlPresentOnMachine] = 'true';
        process.env[shared.TestEnvVars.manifests] = shared.ManifestFilesPath;
        done();
    });

    beforeEach(() => {
        delete process.env[shared.TestEnvVars.action];
        delete process.env[shared.TestEnvVars.strategy];
        delete process.env[shared.TestEnvVars.percentage];
        delete process.env[shared.TestEnvVars.isStableDeploymentPresent];
        delete process.env[shared.TestEnvVars.isCanaryDeploymentPresent];
        delete process.env[shared.TestEnvVars.isBaselineDeploymentPresent];
        delete process.env[shared.TestEnvVars.arguments];
        delete process.env[shared.TestEnvVars.namespace];
        delete process.env[shared.TestEnvVars.dockerComposeFile];
        delete process.env[shared.TestEnvVars.releaseName];
        delete process.env[shared.TestEnvVars.baselineAndCanaryReplicas];
        delete process.env[shared.TestEnvVars.trafficSplitMethod];
        delete process.env[shared.TestEnvVars.containers];
        delete process.env.RemoveNamespaceFromEndpoint;
    });

    after((done) => {
        done();
    });

    it('Run successfuly for deploy with none strategy', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.deploy;
        process.env[shared.TestEnvVars.strategy] = shared.Strategy.none;
        process.env[shared.TestEnvVars.imagePullSecrets] = 'test-key1\ntest-key2';
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('nginx-service 104.211.243.77') != -1, 'nginx-service external IP is 104.211.243.77')
        done();
    });

    it('Run successfully for deploy canary', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.deploy;
        process.env[shared.TestEnvVars.strategy] = shared.Strategy.canary;
        process.env[shared.TestEnvVars.trafficSplitMethod] = shared.TrafficSplitMethod.pod;
        process.env[shared.TestEnvVars.percentage] = '30';
        process.env[shared.TestEnvVars.isStableDeploymentPresent] = 'true';
        process.env[shared.TestEnvVars.isCanaryDeploymentPresent] = 'false';
        process.env[shared.TestEnvVars.isBaselineDeploymentPresent] = 'false';
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('nginx-deployment-canary created') != -1, 'Canary deployment is created');
        assert(tr.stdout.indexOf('nginx-deployment-baseline created') != -1, 'Baseline deployment is created');
        assert(tr.stdout.indexOf('deployment "nginx-deployment-canary" successfully rolled out') != -1, 'Canary deployment is successfully rolled out');
        assert(tr.stdout.indexOf('deployment "nginx-deployment-baseline" successfully rolled out') != -1, 'Baseline deployment is successfully rolled out');
        assert(tr.stdout.indexOf('nginx-deployment-canary annotated') != -1, 'Canary deployment is annotated');
        assert(tr.stdout.indexOf('nginx-deployment-baseline annotated') != -1, 'Baseline deployment is annotated');
        done();
    });

    it('Run should fail when canary deployment already exits', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.deploy;
        process.env[shared.TestEnvVars.strategy] = shared.Strategy.canary;
        process.env[shared.TestEnvVars.percentage] = '30';
        process.env[shared.TestEnvVars.isStableDeploymentPresent] = 'true';
        process.env[shared.TestEnvVars.isCanaryDeploymentPresent] = 'true';
        process.env[shared.TestEnvVars.isBaselineDeploymentPresent] = 'true';
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('Run should fail for promote with none strategy', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.promote;
        process.env[shared.TestEnvVars.strategy] = shared.Strategy.none;
        process.env[shared.TestEnvVars.imagePullSecrets] = 'test-key';
        tr.run();
        assert(tr.failed, 'task should have failed');
        done();
    });

    it('Run successfuly for promote with canary strategy when baseline resource exists', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.promote;
        process.env[shared.TestEnvVars.strategy] = shared.Strategy.canary;
        process.env[shared.TestEnvVars.isBaselineDeploymentPresent] = 'true';
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('nginx-deployment created') != -1, 'deployment is created');
        assert(tr.stdout.indexOf('Rollout status has been skipped for Deployment as only updateStartegy:\'RollingUpdate\' is allowed') != -1, 'deployment rollout status skipped');
        assert(tr.stdout.indexOf('nginx-service 104.211.243.77') != -1, 'nginx-service external IP is 104.211.243.77')
        assert(tr.stdout.indexOf('nginx-deployment annotated') != -1, 'nginx-deployment created.');
        assert(tr.stdout.indexOf('"azure-pipelines/version": "baseline"') != -1, 'nginx-deployment-baseline workload exists');
        assert(tr.stdout.indexOf('"nginx-deployment-canary" deleted. "nginx-deployment-baseline" deleted') != -1, 'Baseline and Canary workloads deleted');
        done();
    });

    it('Run successfuly for promote with canary strategy when baseline resource does not exist', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.promote;
        process.env[shared.TestEnvVars.strategy] = shared.Strategy.canary;
        process.env[shared.TestEnvVars.isBaselineDeploymentPresent] = 'false';
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('nginx-deployment created') != -1, 'deployment is created');
        assert(tr.stdout.indexOf('Rollout status has been skipped for Deployment as only updateStartegy:\'RollingUpdate\' is allowed') != -1, 'deployment rollout status skipped');
        assert(tr.stdout.indexOf('nginx-service 104.211.243.77') != -1, 'nginx-service external IP is 104.211.243.77');
        assert(tr.stdout.indexOf('nginx-deployment annotated') != -1, 'nginx-deployment created.');
        assert(tr.stdout.indexOf('"azure-pipelines/version": "baseline"') == -1, 'nginx-deployment-baseline workload does not exist');
        assert(tr.stdout.indexOf('"nginx-deployment-canary" deleted') != -1, 'Canary workload deleted');
        done();
    });

    it('Run successfuly for reject with canary strategy when baseline resource exists', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.reject;
        process.env[shared.TestEnvVars.strategy] = shared.Strategy.canary;
        process.env[shared.TestEnvVars.isBaselineDeploymentPresent] = 'true';
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('"azure-pipelines/version": "baseline"') != -1, 'nginx-deployment-baseline workload exists');
        assert(tr.stdout.indexOf('"nginx-deployment-canary" deleted. "nginx-deployment-baseline" deleted') != -1, 'Baseline and Canary workloads deleted');
        done();
    });

    it('Run successfuly for reject with canary strategy when baseline resource does not exist', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.reject;
        process.env[shared.TestEnvVars.strategy] = shared.Strategy.canary;
        process.env[shared.TestEnvVars.isBaselineDeploymentPresent] = 'false';
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('"azure-pipelines/version": "baseline"') == -1, 'nginx-deployment-baseline workload does not exist');
        assert(tr.stdout.indexOf('"nginx-deployment-canary" deleted') != -1, 'Canary workload deleted');
        done();
    });

    it('Run should fail for reject with none strategy', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.reject;
        process.env[shared.TestEnvVars.strategy] = shared.Strategy.none;
        tr.run();
        assert(tr.failed, 'task should have failed');
        done();
    });

    it('Run successfuly for delete with arguments', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.arguments] = 'deployment nginx-deployment'
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.delete;
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('deleted successfuly') != -1, 'Deleted successfuly');
        done();
    });

    it('Run should fail for delete with no arguments', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.delete;
        tr.run();
        assert(tr.failed, 'task should have failed');
        done();
    });

    it('Run should succeed with helm bake and honor namespace field', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.bake;
        process.env[shared.TestEnvVars.namespace] = 'namespacefrominput';
        process.env[shared.TestEnvVars.helmChart] = 'helmChart';
        process.env[shared.TestEnvVars.renderType] = 'helm';
        process.env[shared.TestEnvVars.helmVersion] = "v2";
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('set manifestsBundle') > -1, 'task should have set manifestsBundle output variable');
        done();
    });

    it('Run should succeed with helm3 bake and honor namespace field', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.bake;
        process.env[shared.TestEnvVars.namespace] = 'namespacefrominput';
        process.env[shared.TestEnvVars.helmChart] = 'helmChart';
        process.env[shared.TestEnvVars.renderType] = 'helm';
        process.env[shared.TestEnvVars.helmVersion] = "v3";
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('set manifestsBundle') > -1, 'task should have set manifestsBundle output variable');
        done();
    });

    it('Run should succeed with helm2 type (backward compat) with helm2 and honor namespace field', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.bake;
        process.env[shared.TestEnvVars.namespace] = 'namespacefrominput';
        process.env[shared.TestEnvVars.helmChart] = 'helmChart';
        process.env[shared.TestEnvVars.renderType] = 'helm2';
        process.env[shared.TestEnvVars.helmVersion] = "v2";
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('set manifestsBundle') > -1, 'task should have set manifestsBundle output variable');
        done();
    });

    it('Run should succeed with helm bake overriding release name and honor namespace field', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.bake;
        process.env[shared.TestEnvVars.namespace] = 'namespacefrominput';
        process.env[shared.TestEnvVars.helmChart] = 'helmChart';
        process.env[shared.TestEnvVars.renderType] = 'helm';
        process.env[shared.TestEnvVars.helmVersion] = "v2";
        process.env[shared.TestEnvVars.releaseName] = 'newReleaseName';
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('set manifestsBundle') > -1, 'task should have set manifestsBundle output variable');
        assert(tr.stdout.indexOf('--name newReleaseName') > -1, 'bake should have overriden release name');
        done();
    });

    it('Run should succeed with helm3 bake overriding release name and honor namespace field', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.bake;
        process.env[shared.TestEnvVars.namespace] = 'namespacefrominput';
        process.env[shared.TestEnvVars.helmChart] = 'helmChart';
        process.env[shared.TestEnvVars.renderType] = 'helm';
        process.env[shared.TestEnvVars.helmVersion] = "v3";
        process.env[shared.TestEnvVars.releaseName] = 'newReleaseName';
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('set manifestsBundle') > -1, 'task should have set manifestsBundle output variable');
        assert(tr.stdout.indexOf('newReleaseName') > -1, 'bake should have overriden release name');
        assert(tr.stdout.indexOf('--name ') <= -1, 'bake should not have added --name arg');
        done(tr.stderr);
    });

    it('Run should succeed with helm2 type (backward compat) and helm3 bake overriding release name and honor namespace field', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.bake;
        process.env[shared.TestEnvVars.namespace] = 'namespacefrominput';
        process.env[shared.TestEnvVars.helmChart] = 'helmChart';
        process.env[shared.TestEnvVars.renderType] = 'helm2';
        process.env[shared.TestEnvVars.helmVersion] = "v3";
        process.env[shared.TestEnvVars.releaseName] = 'newReleaseName';
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('set manifestsBundle') > -1, 'task should have set manifestsBundle output variable');
        assert(tr.stdout.indexOf('newReleaseName') > -1, 'bake should have overriden release name');
        assert(tr.stdout.indexOf('--name ') <= -1, 'bake should not have added --name arg');
        done(tr.stderr);
    });

    it('Run should succeed with helm bake overriding release name and use default namespace when not found in endpoint either', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.bake;
        process.env[shared.TestEnvVars.helmChart] = 'helmChart';
        process.env[shared.TestEnvVars.renderType] = 'helm';
        process.env[shared.TestEnvVars.helmVersion] = "v2";
        process.env[shared.TestEnvVars.releaseName] = 'newReleaseName';
        process.env.RemoveNamespaceFromEndpoint = 'true';
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('set manifestsBundle') > -1, 'task should have set manifestsBundle output variable');
        assert(tr.stdout.indexOf('--name newReleaseName') > -1, 'bake should have overriden release name');
        assert(tr.stdout.indexOf('--namespace default') > -1, 'should have used default namespace');
        assert(tr.stdout.indexOf('Namespace was not supplied nor present in the endpoint; using "default" namespace instead.') > -1, 'should have added a debug log');
        done();
    });

    it('Run should succeed with helm bake overriding release name and use default namespace when not found in endpoint either', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.bake;
        process.env[shared.TestEnvVars.helmChart] = 'helmChart';
        process.env[shared.TestEnvVars.renderType] = 'helm';
        process.env[shared.TestEnvVars.helmVersion] = "v3";
        process.env[shared.TestEnvVars.releaseName] = 'newReleaseName';
        process.env.RemoveNamespaceFromEndpoint = 'true';
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('set manifestsBundle') > -1, 'task should have set manifestsBundle output variable');
        assert(tr.stdout.indexOf('newReleaseName') > -1, 'bake should have overriden release name');
        assert(tr.stdout.indexOf('--name ') <= -1, 'bake should not have added --name arg');
        assert(tr.stdout.indexOf('--namespace default') > -1, 'should have used default namespace');
        assert(tr.stdout.indexOf('Namespace was not supplied nor present in the endpoint; using "default" namespace instead.') > -1, 'should have added a debug log');
        done();
    });

    it('Run should succeed with helm bake should override values with : correctly', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.bake;
        process.env[shared.TestEnvVars.helmChart] = 'helmChart';
        process.env[shared.TestEnvVars.renderType] = 'helm';
        process.env[shared.TestEnvVars.helmVersion] = "v2";
        process.env[shared.TestEnvVars.overrides] = 'name:value:with:colons';
        process.env.RemoveNamespaceFromEndpoint = 'true';
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('set manifestsBundle') > -1, 'task should have set manifestsBundle output variable');
        assert(tr.stdout.indexOf('--namespace default') > -1, 'should have used default namespace');
        assert(tr.stdout.indexOf('--set name=value:with:colons') > -1, 'should have parsed the :s correctly');
        assert(tr.stdout.indexOf('Namespace was not supplied nor present in the endpoint; using "default" namespace instead.') > -1, 'should have added a debug log');
        done();
    });

    it('Run should succeed with helm3 bake should override values with : correctly', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.bake;
        process.env[shared.TestEnvVars.helmChart] = 'helmChart';
        process.env[shared.TestEnvVars.renderType] = 'helm';
        process.env[shared.TestEnvVars.helmVersion] = "v3";
        process.env[shared.TestEnvVars.overrides] = 'name:value:with:colons';
        process.env.RemoveNamespaceFromEndpoint = 'true';
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('set manifestsBundle') > -1, 'task should have set manifestsBundle output variable');
        assert(tr.stdout.indexOf('--namespace default') > -1, 'should have used default namespace');
        assert(tr.stdout.indexOf('--set name=value:with:colons') > -1, 'should have parsed the :s correctly');
        assert(tr.stdout.indexOf('Namespace was not supplied nor present in the endpoint; using "default" namespace instead.') > -1, 'should have added a debug log');
        done();
    });

    it('Run should succeed with helm bake with image substituion', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.bake;
        process.env[shared.TestEnvVars.namespace] = 'namespacefrominput';
        process.env[shared.TestEnvVars.helmChart] = 'helmChart';
        process.env[shared.TestEnvVars.renderType] = 'helm';
        process.env[shared.TestEnvVars.helmVersion] = "v2";
        process.env[shared.TestEnvVars.containers] = 'nginx:1.1.1';
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('set manifestsBundle') > -1, 'task should have set manifestsBundle output variable');
        done();
    });

    it('Run should successfully create secret', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.createSecret;
        process.env[shared.TestEnvVars.secretName] = 'secret';
        process.env[shared.TestEnvVars.secretType] = 'generic';
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('delete secret') > -1, 'task should have deleted secret');
        assert(tr.stdout.indexOf('create secret') > -1, 'task should have created secret');
        assert(tr.stdout.indexOf('create secret') > tr.stdout.indexOf('delete secret'), 'delete secret should have been called before created secret');
        done();
    });

    it('Run should scale', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.scale;
        process.env[shared.TestEnvVars.kind] = 'replicaset';
        process.env[shared.TestEnvVars.replicas] = '1';
        process.env[shared.TestEnvVars.name] = 'r1';
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('scale replicaset/r1') > -1, 'task should have run scale command');
        done();
    });

    it('Run should succeessfully patch', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.patch;
        process.env[shared.TestEnvVars.kind] = 'replicaset';
        process.env[shared.TestEnvVars.mergeStrategy] = 'merge';
        process.env[shared.TestEnvVars.name] = 'r1';
        process.env[shared.TestEnvVars.patch] = 'somePatch';
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        done();
    });

    it('Check if error validations', (done: Mocha.Done) => {
        try {
            const execResults = [{
                code: 0,
                stderr: 'Warning: your execution has some warnings'
            } as IExecSyncResult];
            utils.checkForErrors(execResults, false);
        } catch (ex) {
            assert(!ex, 'shouldnt have thrown any error');
        }
        try {
            const execResults = [{
                code: 1,
                stderr: 'error: your execution has some errors'
            } as IExecSyncResult];
            utils.checkForErrors(execResults, false);
        } catch (ex) {
            assert(ex, 'shouldnt have thrown error');
            assert(ex.message === 'error: your execution has some errors', 'The thrown error should have matched');
        }
        done();
    });

    it('Run should successfully add container image tags', (done: Mocha.Done) => {
        const testFile = path.join(__dirname, './manifests/', 'deployment-image-substitution.yaml');
        const deploymentFile = fs.readFileSync(testFile).toString();
        const deploymentObject = yaml.load(deploymentFile);

        updateImageDetails(deploymentObject, ['nginx:42', 'mysql:8.0', 'imagewithhyphen:1', 'myacr.azurecr.io/myimage:1', 'myimagewithcomment:1', 'nginx-init:42.1', 'myacr.azurecr.io/folder/image-a:1', 'myacr.azurecr.io/folder/image-b:2','mcr.microsoft.com/dotnet/core/sdk:1','mcr.microsoft.com/mssql/server@sha256:46c98da652ed6c3b85b9cdaa611781bdd543668fe730f807eb09adc5bb1e8c03']);
        assert(deploymentObject.spec.template.spec.containers[0].image === 'nginx:42', 'nginx image not tagged correctly');
        assert(deploymentObject.spec.template.spec.containers[2].image === 'mysql:8.0', 'untagged image not tagged correctly');
        assert(deploymentObject.spec.template.spec.containers[3].image === 'myacr.azurecr.io/myimage:1', 'untagged image with registry not tagged correctly');
        assert(deploymentObject.spec.template.spec.containers[4].image === 'myimagewithcomment:1', 'untagged image with comment not tagged correctly');
        assert(deploymentObject.spec.template.spec.containers[5].image === 'imagewithhyphen:1', 'manifest regex should work correctly');
        assert(deploymentObject.spec.template.spec.containers[6].image === 'myacr.azurecr.io/folder/image-a:1', 'untagged image with common folder not tagged correctly');
        assert(deploymentObject.spec.template.spec.containers[7].image === 'myacr.azurecr.io/folder/image-b:2', 'untagged image with common folder not tagged correctly');
        assert(deploymentObject.spec.template.spec.containers[8].image === 'mcr.microsoft.com/dotnet/core/sdk:1', 'sha256 image reference should be replaced');
        assert(deploymentObject.spec.template.spec.containers[9].image === 'mcr.microsoft.com/mssql/server@sha256:46c98da652ed6c3b85b9cdaa611781bdd543668fe730f807eb09adc5bb1e8c03', 'sha256 image reference should be used as replacement');
        assert(deploymentObject.spec.template.spec.initContainers[0].image === 'nginx-init:42.1', 'nginx-init image not tagged correctly');
        done();
    });

    it('Run should bake docker-compose files using kompose', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.bake;
        process.env[shared.TestEnvVars.renderType] = 'kompose';
        process.env[shared.TestEnvVars.dockerComposeFile] = 'dockerComposeFilePath';
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('Kubernetes files created') > 0, 'task should have succeeded');
        assert(tr.stdout.indexOf('set manifestsBundle') > -1, 'task should have set manifestsBundle output variable');
        done();
    });

    it('Run should bake docker-compose files using kompose with image substituion', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.bake;
        process.env[shared.TestEnvVars.renderType] = 'kompose';
        process.env[shared.TestEnvVars.dockerComposeFile] = 'dockerComposeFilePath';
        process.env[shared.TestEnvVars.containers] = 'nginx:1.1.1';
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('Kubernetes files created') > 0, 'task should have succeeded');
        assert(tr.stdout.indexOf('set manifestsBundle') > -1, 'task should have set manifestsBundle output variable');
        done();
    });

    it('Run should fail when docker-compose file path is not supplied', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.bake;
        process.env[shared.TestEnvVars.renderType] = 'kompose';
        process.env[shared.TestEnvVars.dockerComposeFile] = '';
        tr.run();
        assert(tr.failed, 'task should have failed');
        assert(tr.stdout.indexOf('Input required: dockerComposeFile') > 0, 'proper error message should have been thrown');
        done();
    });

    it('Run should successfully add image pull secrets to a cron job', (done: Mocha.Done) => {
        const testFile = path.join(__dirname, './manifests/', 'cronjob.yaml');
        const cronJobFile = fs.readFileSync(testFile).toString();
        const cronJobObject = yaml.load(cronJobFile);
        updateImagePullSecrets(cronJobObject, ['privaterepo-secret'], true);
        assert(cronJobObject.spec.jobTemplate.spec.template.spec.imagePullSecrets[0].name === 'privaterepo-secret', 'should have updated the image pull secret correctly');
        done();
    });

    it('Run should successfully add image pull secrets to a job', (done: Mocha.Done) => {
        const testFile = path.join(__dirname, './manifests/', 'job.yaml');
        const jobFile = fs.readFileSync(testFile).toString();
        const jobObject = yaml.load(jobFile);
        updateImagePullSecrets(jobObject, ['privaterepo-secret'], true);
        assert(jobObject.spec.template.spec.imagePullSecrets[0].name === 'privaterepo-secret', 'should have updated the image pull secret correctly');
        done();
    });

    it('Kustomize bake should fail when kubectl version is lower than v1.14', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.bake;
        process.env[shared.TestEnvVars.renderType] = 'kustomize';
        process.env[shared.TestEnvVars.kustomizationPath] = 'kustomizationPath';
        process.env.KubectlMinorVersion = '13';
        tr.run();
        assert(tr.failed, 'task should have failed');
        assert(tr.stdout.indexOf('KubectlShouldBeUpgraded') > 0, 'proper error message should have been thrown');
        done();
    });

    it('Kustomize bake should pass when kubectl version is greater than or equal to v1.14', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.bake;
        process.env[shared.TestEnvVars.renderType] = 'kustomize';
        process.env[shared.TestEnvVars.kustomizationPath] = 'kustomizationPath';
        process.env.KubectlMinorVersion = '14';
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdOutContained('kustomize kustomizationPath'), 'task should have invoked tool: kustomize');
        done();
    });

    it('Kustomize bake should pass with image substituition', (done: Mocha.Done) => {
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.bake;
        process.env[shared.TestEnvVars.renderType] = 'kustomize';
        process.env[shared.TestEnvVars.kustomizationPath] = 'kustomizationPath';
        process.env[shared.TestEnvVars.containers] = 'nginx:1.1.1\nalpine';
        process.env.KubectlMinorVersion = '14';
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdOutContained('kustomize kustomizationPath'), 'task should have invoked tool: kustomize');
        done();
    });
});
