import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';
import tl = require('vsts-task-lib');
import * as shared from './TestShared';

describe('Kubernetes Manifests Suite', function () {
    this.timeout(30000);
    before((done) => {
        process.env[shared.TestEnvVars.operatingSystem] = tl.osType().match(/^Win/) ? shared.OperatingSystems.Windows : shared.OperatingSystems.Other;
        process.env[shared.TestEnvVars.isKubectlPresentOnMachine] = "true";
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
    });
    after(function () {
    });

    it('Run successfuly for deploy with none strategy', (done: MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.deploy;
        process.env[shared.TestEnvVars.strategy] = shared.Strategy.none;
        process.env[shared.TestEnvVars.imagePullSecrets] = "test-key1\ntest-key2";
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        console.log(tr.stdout);
        done();
    });
    it('Run successfully for deploy canary', (done: MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.deploy;
        process.env[shared.TestEnvVars.strategy] = shared.Strategy.canary;
        process.env[shared.TestEnvVars.percentage] = "30";
        process.env[shared.TestEnvVars.isStableDeploymentPresent] = "true";
        process.env[shared.TestEnvVars.isCanaryDeploymentPresent] = "false";
        process.env[shared.TestEnvVars.isBaselineDeploymentPresent] = "false";
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stderr.indexOf("\"nginx-deployment-canary\" not found") != -1, "Canary deployment is not present");
        assert(tr.stdout.indexOf("nginx-deployment-canary created") != -1, "Canary deployment is created");
        assert(tr.stdout.indexOf("nginx-deployment-baseline created") != -1, "Baseline deployment is created");
        assert(tr.stdout.indexOf("deployment \"nginx-deployment-canary\" successfully rolled out") != -1, "Canary deployment is successfully rolled out");
        assert(tr.stdout.indexOf("deployment \"nginx-deployment-baseline\" successfully rolled out") != -1, "Baseline deployment is successfully rolled out");
        assert(tr.stdout.indexOf("nginx-deployment-canary annotated") != -1, "Canary deployment is annotated");
        assert(tr.stdout.indexOf("nginx-deployment-baseline annotated") != -1, "Baseline deployment is annotated");
        done();
    });
    it('Run should fail when canary deployment already exits', (done: MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.deploy;
        process.env[shared.TestEnvVars.strategy] = shared.Strategy.canary;
        process.env[shared.TestEnvVars.percentage] = "30";
        process.env[shared.TestEnvVars.isStableDeploymentPresent] = "true";
        process.env[shared.TestEnvVars.isCanaryDeploymentPresent] = "true";
        process.env[shared.TestEnvVars.isBaselineDeploymentPresent] = "true";
        tr.run();
        assert(tr.failed, 'task should have failed');
        done();
    });
    it('Run should fail for promote with none strategy', (done: MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.promote;
        process.env[shared.TestEnvVars.strategy] = shared.Strategy.none;
        process.env[shared.TestEnvVars.imagePullSecrets] = "test-key";
        tr.run();
        assert(tr.failed, 'task should have failed');
        done();
    });
    it('Run successfuly for promote with canary strategy', (done: MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.promote;
        process.env[shared.TestEnvVars.strategy] = shared.Strategy.canary;
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf("nginx-deployment created") != -1, "deployment is created");
        assert(tr.stdout.indexOf("deployment \"nginx-deployment\" successfully rolled out") != -1, "deployment is successfully rolled out");
        assert(tr.stdout.indexOf("nginx-deployment annotated") != -1, "nginx-deployment created.");
        assert(tr.stdout.indexOf("\"nginx-deployment-canary\" deleted. \"nginx-deployment-baseline\" deleted") != -1, "Baseline and canary workloads are deleted");
        done();
    });
    it('Run successfuly for reject with canary strategy', (done: MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.reject;
        process.env[shared.TestEnvVars.strategy] = shared.Strategy.canary;
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf("\"nginx-deployment-canary\" deleted. \"nginx-deployment-baseline\" deleted") != -1, "Baseline and canary workloads are deleted");
        done();
    });
    it('Run should fail for reject with none strategy', (done: MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.reject;
        process.env[shared.TestEnvVars.strategy] = shared.Strategy.none;
        tr.run();
        assert(tr.failed, 'task should have failed');
        done();
    });
    it('Run successfuly for delete with arguments', (done: MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.arguments] = "deployment nginx-deployment"
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.delete;
        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf("deleted successfuly") != -1, "Deleted successfuly");
        done();
    });
    it('Run should fail for delete with no arguments', (done: MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.Actions.delete;
        tr.run();
        assert(tr.failed, 'task should have failed');
        done();
    });
});