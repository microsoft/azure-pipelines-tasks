import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';
import tl = require('vsts-task-lib');
import * as shared from './TestShared';

describe('Kubernetes Suite', function() {
    this.timeout(30000);
    before((done) => {
        process.env[shared.TestEnvVars.operatingSystem] = tl.osType().match(/^Win/) ? shared.OperatingSystems.Windows : shared.OperatingSystems.Other;
        done();
    });
    beforeEach(() => {
        process.env[shared.isKubectlPresentOnMachine] = "true";
        delete process.env[shared.TestEnvVars.command];
        delete process.env[shared.TestEnvVars.containerType];
        delete process.env[shared.TestEnvVars.versionOrLocation];
        delete process.env[shared.TestEnvVars.specifyLocation];
        delete process.env[shared.TestEnvVars.versionSpec];
        delete process.env[shared.TestEnvVars.checkLatest];
        delete process.env[shared.TestEnvVars.namespace];
        delete process.env[shared.TestEnvVars.arguments];
        delete process.env[shared.TestEnvVars.useConfigurationFile];
        delete process.env[shared.TestEnvVars.secretName];
        delete process.env[shared.TestEnvVars.forceUpdate];
        delete process.env[shared.TestEnvVars.outputFormat];
        delete process.env[shared.TestEnvVars.kubectlOutput];
    });
    after(function () {
    });

    it('Run successfully when the user provides a specific location for kubectl', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";    
        process.env[shared.TestEnvVars.versionOrLocation] = "location";
        process.env[shared.TestEnvVars.specifyLocation] = shared.formatPath("newUserDir/kubectl.exe");
        process.env[shared.isKubectlPresentOnMachine] = "false";
        tr.run();

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.stdout.indexOf(`Set kubectlPath to ${shared.formatPath("newUserDir/kubectl.exe")} and added permissions`) != -1, "Kubectl path should be set to the correct location");
        assert(tr.stdout.indexOf(`[command]${shared.formatPath("newUserDir/kubectl.exe")} --kubeconfig ${shared.formatPath("newUserDir/config")} get pods`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });

    it('Run successfully when the user provides the version for kubectl with checkLatest as false and version that dosent have a v prefix', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";    
        process.env[shared.TestEnvVars.versionOrLocation] = "version";
        process.env[shared.TestEnvVars.versionSpec] = "1.7.0";
        process.env[shared.isKubectlPresentOnMachine] = "false";
        tr.run();
        console.log(tr.stdout);

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`Got kubectl version v1.7.0`) != -1, "Got the specific version of kubectl");
        assert(tr.stdout.indexOf(`Downloaded kubectl version v1.7.0`) != -1, "Downloaded correct version of kubectl");
        assert(tr.stdout.indexOf(`[command]${shared.formatPath("newUserDir/kubectl.exe")} --kubeconfig ${shared.formatPath("newUserDir/config")} get pods`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });

    it('Run successfully when the user provides the version for kubectl with checkLatest as true', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";    
        process.env[shared.TestEnvVars.versionOrLocation] = "version";
        process.env[shared.TestEnvVars.versionSpec] = "1.5.0";
        process.env[shared.TestEnvVars.checkLatest] = "true";
        process.env[shared.isKubectlPresentOnMachine] = "false";
        tr.run();
        console.log(tr.stdout);

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`Get stable kubectl version`) != -1, "Stable version of kubectl is downloaded");
        assert(tr.stdout.indexOf(`Got kubectl version v1.6.6`) != -1, "Got the latest version of kubectl");
        assert(tr.stdout.indexOf(`Downloaded kubectl version v1.6.6`) != -1, "Downloaded correct version of kubectl");
        assert(tr.stdout.indexOf(`[command]${shared.formatPath("newUserDir/kubectl.exe")} --kubeconfig ${shared.formatPath("newUserDir/config")} get pods`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });

    it('Run successfully when the user provides the version 1.7 for kubectl with checkLatest as false', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";    
        process.env[shared.TestEnvVars.versionOrLocation] = "version";
        process.env[shared.TestEnvVars.versionSpec] = "1.7";
        process.env[shared.isKubectlPresentOnMachine] = "false";
        tr.run();
        console.log(tr.stdout);

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`Get stable kubectl version`) != -1, "Stable version of kubectl is downloaded");
        assert(tr.stdout.indexOf(`Got kubectl version v1.6.6`) != -1, "Got the latest version of kubectl");
        assert(tr.stdout.indexOf(`Downloaded kubectl version v1.6.6`) != -1, "Downloaded correct version of kubectl");
        assert(tr.stdout.indexOf(`[command]${shared.formatPath("newUserDir/kubectl.exe")} --kubeconfig ${shared.formatPath("newUserDir/config")} get pods`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });

    it('Run fails when the user provides a wrong location for kubectl', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";    
        process.env[shared.TestEnvVars.versionOrLocation] = "location";
        process.env[shared.TestEnvVars.specifyLocation] = shared.formatPath("wrongDir/kubectl.exe");
        process.env[shared.isKubectlPresentOnMachine] = "false";
        tr.run();
        
        assert(tr.failed, 'task should have failed');
        assert(tr.invokedToolCount == 0, 'should have invoked tool 0 times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length > 0 || tr.errorIssues.length, 'should have written to stderr');
        assert(tr.stdout.indexOf(`Not found ${shared.formatPath("wrongDir/kubectl.exe")}`) != -1, "kubectl get should not run");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for kubectl apply using configuration file', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.apply;
        process.env[shared.TestEnvVars.useConfigurationFile] = "true";    
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]kubectl --kubeconfig ${shared.formatPath("newUserDir/config")} apply -f ${shared.formatPath("dir/deployment.yaml")}`) != -1, "kubectl apply should run");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for kubectl expose with configuration file and arguments', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.expose;
        process.env[shared.TestEnvVars.useConfigurationFile] = "true";
        process.env[shared.TestEnvVars.arguments] = "--port=80 --target-port=8000";
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]kubectl --kubeconfig ${shared.formatPath("newUserDir/config")} expose -f ${shared.formatPath("dir/deployment.yaml")} --port=80 --target-port=8000`) != -1, "kubectl expose should run");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for kubectl get', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]kubectl --kubeconfig ${shared.formatPath("newUserDir/config")} get pods`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for kubectl get in a particular namespace', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.namespace] = "kube-system";
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]kubectl --kubeconfig ${shared.formatPath("newUserDir/config")} get -n kube-system pods`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for kubectl docker-registry secrets using Container Registry with forceUpdate', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.containerType] = shared.ContainerTypes.ContainerRegistry;
        process.env[shared.TestEnvVars.secretName] = "my-secret";
        tr.run();

        assert(tr.invokedToolCount == 2, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`DeleteSecret my-secret`) != -1, "kubectl delete should run");
        assert(tr.stdout.indexOf(`[command]kubectl --kubeconfig ${shared.formatPath("newUserDir/config")} create secret docker-registry my-secret --docker-server=https://index.docker.io/v1/ --docker-username=test --docker-password=regpassword --docker-email=test@microsoft.com`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`[command]kubectl --kubeconfig ${shared.formatPath("newUserDir/config")} get pods`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for kubectl docker-registry secrets using Container Registry without forceUpdate', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.containerType] = shared.ContainerTypes.ContainerRegistry;
        process.env[shared.TestEnvVars.secretName] = "my-secret";
        process.env[shared.TestEnvVars.forceUpdate] = "false";
        tr.run();

        assert(tr.invokedToolCount == 2, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`DeleteSecret my-secret`) == -1, "kubectl delete should not run");
        assert(tr.stdout.indexOf(`[command]kubectl --kubeconfig ${shared.formatPath("newUserDir/config")} create secret docker-registry my-secret --docker-server=https://index.docker.io/v1/ --docker-username=test --docker-password=regpassword --docker-email=test@microsoft.com`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`[command]kubectl --kubeconfig ${shared.formatPath("newUserDir/config")} get pods`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for kubectl docker-registry secrets using AzureContainerRegistry Registry with forceUpdate', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.containerType] = shared.ContainerTypes.AzureContainerRegistry;
        process.env[shared.TestEnvVars.secretName] = "my-secret";
        tr.run();

        assert(tr.invokedToolCount == 2, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`DeleteSecret my-secret`) != -1, "kubectl delete should run");
        assert(tr.stdout.indexOf(`[command]kubectl --kubeconfig ${shared.formatPath("newUserDir/config")} create secret docker-registry my-secret --docker-server=ajgtestacr1.azurecr.io --docker-username=spId --docker-password=spKey --docker-email=ServicePrincipal@AzureRM`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`[command]kubectl --kubeconfig ${shared.formatPath("newUserDir/config")} get pods`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });

     it('Runs successfully for kubectl docker-registry secrets using AzureContainerRegistry without forceUpdate', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.containerType] = shared.ContainerTypes.AzureContainerRegistry;
        process.env[shared.TestEnvVars.secretName] = "my-secret";
        process.env[shared.TestEnvVars.forceUpdate] = "false";
        tr.run();

        assert(tr.invokedToolCount == 2, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`DeleteSecret my-secret`) == -1, "kubectl delete should not run");
        assert(tr.stdout.indexOf(`[command]kubectl --kubeconfig ${shared.formatPath("newUserDir/config")} create secret docker-registry my-secret --docker-server=ajgtestacr1.azurecr.io --docker-username=spId --docker-password=spKey --docker-email=ServicePrincipal@AzureRM`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`[command]kubectl --kubeconfig ${shared.formatPath("newUserDir/config")} get pods`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for kubectl get and print the output in a particular format', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "secrets my-secret";
        process.env[shared.TestEnvVars.outputFormat] = 'yaml';
        process.env[shared.TestEnvVars.kubectlOutput] = "secretsOutputVariable";
        tr.run();
        
        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]kubectl --kubeconfig ${shared.formatPath("newUserDir/config")} get secrets my-secret -o yaml`) != -1, "kubectl get should run");
        console.log(tr.stderr);
        done();
    });
});
