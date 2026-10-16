import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tl = require('azure-pipelines-task-lib');
import * as shared from './TestShared';

describe('Kubernetes Suite', function() {
    this.timeout(30000);
    before(async () => {
        process.env[shared.TestEnvVars.operatingSystem] = tl.osType().match(/^Win/) ? shared.OperatingSystems.Windows : shared.OperatingSystems.Other;
        
    });
    beforeEach(async () => {
        process.env[shared.isKubectlPresentOnMachine] = "true";
        process.env[shared.endpointAuthorizationType] = "Kubeconfig";
        process.env[shared.TestEnvVars.outputFormat] = 'json';
        delete process.env[shared.TestEnvVars.command];
        delete process.env[shared.TestEnvVars.containerType];
        delete process.env[shared.TestEnvVars.connectionType];
        delete process.env[shared.TestEnvVars.versionOrLocation];
        delete process.env[shared.TestEnvVars.specifyLocation];
        delete process.env[shared.TestEnvVars.versionSpec];
        delete process.env[shared.TestEnvVars.checkLatest];
        delete process.env[shared.TestEnvVars.namespace];
        delete process.env[shared.TestEnvVars.arguments];
        delete process.env[shared.TestEnvVars.useConfigurationFile];
        delete process.env[shared.TestEnvVars.configurationType];
        delete process.env[shared.TestEnvVars.secretType];
        delete process.env[shared.TestEnvVars.secretArguments];
        delete process.env[shared.TestEnvVars.secretName];
        delete process.env[shared.TestEnvVars.forceUpdate];
        delete process.env[shared.TestEnvVars.configMapName];
        delete process.env[shared.TestEnvVars.forceUpdateConfigMap];
        delete process.env[shared.TestEnvVars.useConfigMapFile];
        delete process.env[shared.TestEnvVars.configMapFile];
        delete process.env[shared.TestEnvVars.configMapArguments];
        delete process.env[shared.TestEnvVars.configuration];
        delete process.env["chmodShouldThrowError"];
    });
 
    it('Run successfully when the connectionType is Kubernetes Service Connection', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";    
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionType.KubernetesServiceConnection;        
        await tr.runAsync();

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
    });

    it('Run successfully when the authorization type of the endpoint is service account and connectionType is Kubernetes Service Connection', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";    
        process.env[shared.TestEnvVars.connectionType] = shared.ConnectionType.KubernetesServiceConnection;
        process.env[shared.endpointAuthorizationType] = "ServiceAccount";
        await tr.runAsync();

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
    });

    it('Run successfully when the user provides a specific location for kubectl', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";    
        process.env[shared.TestEnvVars.versionOrLocation] = "location";
        process.env[shared.TestEnvVars.specifyLocation] = shared.formatPath("newUserDir/kubectl.exe");
        process.env[shared.isKubectlPresentOnMachine] = "false";
        await tr.runAsync();

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.stdout.indexOf(`Set kubectlPath to ${shared.formatPath("newUserDir/kubectl.exe")} and added permissions`) != -1, "Kubectl path should be set to the correct location");
        assert(tr.stdout.indexOf(`[command]${shared.formatPath("newUserDir/kubectl.exe")} get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
    });

    it('Run successfully when the user provides a specific location for kubectl even when chmod fails', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";    
        process.env[shared.TestEnvVars.versionOrLocation] = "location";
        process.env[shared.TestEnvVars.specifyLocation] = shared.formatPath("newUserDir/kubectl.exe");
        process.env[shared.isKubectlPresentOnMachine] = "false";
        process.env["chmodShouldThrowError"] = "true";
        await tr.runAsync();

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.stdout.indexOf(`Could not chmod ${process.env[shared.TestEnvVars.specifyLocation]}`) != -1, "chmod should have failed");
        assert(tr.stdout.indexOf(`[command]${shared.formatPath("newUserDir/kubectl.exe")} get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
    });
 
    it('Run successfully when the user provides the version for kubectl with checkLatest as false and version that dosent have a v prefix', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";    
        process.env[shared.TestEnvVars.versionOrLocation] = "version";
        process.env[shared.TestEnvVars.versionSpec] = "1.13.2";
        process.env[shared.isKubectlPresentOnMachine] = "false";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`Got kubectl version v1.13.2`) != -1, "Got the specific version of kubectl");
        assert(tr.stdout.indexOf(`Downloaded kubectl version v1.13.2`) != -1, "Downloaded correct version of kubectl");
        assert(tr.stdout.indexOf(`[command]${shared.formatPath("newUserDir/kubectl.exe")} get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
    });

    it('Run successfully when the user provides the version for kubectl with checkLatest as true', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";    
        process.env[shared.TestEnvVars.versionOrLocation] = "version";
        process.env[shared.TestEnvVars.versionSpec] = "1.5.0";
        process.env[shared.TestEnvVars.checkLatest] = "true";
        process.env[shared.isKubectlPresentOnMachine] = "false";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`Get stable kubectl version`) != -1, "Stable version of kubectl is downloaded");
        assert(tr.stdout.indexOf(`Got kubectl version v1.6.6`) != -1, "Got the latest version of kubectl");
        assert(tr.stdout.indexOf(`Downloaded kubectl version v1.6.6`) != -1, "Downloaded correct version of kubectl");
        assert(tr.stdout.indexOf(`[command]${shared.formatPath("newUserDir/kubectl.exe")} get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
    });

    it('Run successfully when the user provides the version 1.7 for kubectl with checkLatest as false', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";    
        process.env[shared.TestEnvVars.versionOrLocation] = "version";
        process.env[shared.TestEnvVars.versionSpec] = "1.7";
        process.env[shared.isKubectlPresentOnMachine] = "false";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`Get stable kubectl version`) != -1, "Stable version of kubectl is downloaded");
        assert(tr.stdout.indexOf(`Got kubectl version v1.6.6`) != -1, "Got the latest version of kubectl");
        assert(tr.stdout.indexOf(`Downloaded kubectl version v1.6.6`) != -1, "Downloaded correct version of kubectl");
        assert(tr.stdout.indexOf(`[command]${shared.formatPath("newUserDir/kubectl.exe")} get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
    });

    it('Run fails when the user provides a wrong location for kubectl', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";    
        process.env[shared.TestEnvVars.versionOrLocation] = "location";
        process.env[shared.TestEnvVars.specifyLocation] = shared.formatPath("wrongDir/kubectl.exe");
        process.env[shared.isKubectlPresentOnMachine] = "false";
        await tr.runAsync();
        
        assert(tr.failed, 'task should have failed');
        assert(tr.invokedToolCount == 0, 'should have invoked tool 0 times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length > 0 || tr.errorIssues.length, 'should have written to stderr');
        assert(tr.stdout.indexOf(`Not found ${shared.formatPath("wrongDir/kubectl.exe")}`) != -1, "kubectl get should not run");
        console.log(tr.stderr);
    });

    it('Runs successfully for kubectl apply using configuration file', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.apply;
        process.env[shared.TestEnvVars.useConfigurationFile] = "true";
        process.env[shared.TestEnvVars.configurationType] = shared.ConfigurationTypes.configuration; 
        process.env[shared.TestEnvVars.configuration] = shared.formatPath("dir/deployment.yaml");
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]kubectl apply -f ${shared.formatPath("dir/deployment.yaml")} -o json`) != -1, "kubectl apply should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for kubectl expose with configuration file and arguments', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.expose;
        process.env[shared.TestEnvVars.useConfigurationFile] = "true";
        process.env[shared.TestEnvVars.configurationType] = shared.ConfigurationTypes.configuration;
        process.env[shared.TestEnvVars.configuration] = shared.formatPath("dir/deployment.yaml");
        process.env[shared.TestEnvVars.arguments] = "--port=80 --target-port=8000";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]kubectl expose -f ${shared.formatPath("dir/deployment.yaml")} --port=80 --target-port=8000 -o json`) != -1, "kubectl expose should run");
        console.log(tr.stderr); 
    });

    it('Runs successfully for kubectl get', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for kubectl get in a particular namespace', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.namespace] = "kube-system";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]kubectl get -n kube-system pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for kubectl docker-registry secrets using Container Registry with forceUpdate', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.containerType] = shared.ContainerTypes.ContainerRegistry;
        process.env[shared.TestEnvVars.secretName] = "my-secret";
        await tr.runAsync();

        assert(tr.invokedToolCount == 2, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`DeleteSecret my-secret`) != -1, "kubectl delete should run");
        assert(tr.stdout.indexOf(`[command]kubectl create secret docker-registry my-secret --docker-server=https://index.docker.io/v1/ --docker-username=test --docker-password=regpassword --docker-email=test@microsoft.com`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for kubectl docker-registry secrets using Container Registry without forceUpdate', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.containerType] = shared.ContainerTypes.ContainerRegistry;
        process.env[shared.TestEnvVars.secretName] = "my-secret";
        process.env[shared.TestEnvVars.forceUpdate] = "false";
        await tr.runAsync();

        assert(tr.invokedToolCount == 2, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`DeleteSecret my-secret`) == -1, "kubectl delete should not run");
        assert(tr.stdout.indexOf(`[command]kubectl create secret docker-registry my-secret --docker-server=https://index.docker.io/v1/ --docker-username=test --docker-password=regpassword --docker-email=test@microsoft.com`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for kubectl docker-registry secrets using AzureContainerRegistry Registry with forceUpdate', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.containerType] = shared.ContainerTypes.AzureContainerRegistry;
        process.env[shared.TestEnvVars.secretName] = "my-secret";
        await tr.runAsync();

        assert(tr.invokedToolCount == 2, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`DeleteSecret my-secret`) != -1, "kubectl delete should run");
        assert(tr.stdout.indexOf(`[command]kubectl create secret docker-registry my-secret --docker-server=ajgtestacr1.azurecr.io --docker-username=MOCK_SPN_ID --docker-password=MOCK_SPN_KEY --docker-email=ServicePrincipal@AzureRM`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr); 
    });

     it('Runs successfully for kubectl docker-registry secrets using AzureContainerRegistry without forceUpdate', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.containerType] = shared.ContainerTypes.AzureContainerRegistry;
        process.env[shared.TestEnvVars.secretName] = "my-secret";
        process.env[shared.TestEnvVars.forceUpdate] = "false";
        await tr.runAsync();

        assert(tr.invokedToolCount == 2, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`DeleteSecret my-secret`) == -1, "kubectl delete should not run");
        assert(tr.stdout.indexOf(`[command]kubectl create secret docker-registry my-secret --docker-server=ajgtestacr1.azurecr.io --docker-username=MOCK_SPN_ID --docker-password=MOCK_SPN_KEY --docker-email=ServicePrincipal@AzureRM`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr); 
    });

    it('Runs successfully for kubectl generic secrets with forceUpdate', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.secretType] = "generic";
        process.env[shared.TestEnvVars.secretArguments] = "--from-literal=key1=value1 --from-literal=key2=value2";
        process.env[shared.TestEnvVars.secretName] = "my-secret";
        await tr.runAsync();

        assert(tr.invokedToolCount == 2, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`DeleteSecret my-secret`) != -1, "kubectl delete should run");
        assert(tr.stdout.indexOf(`[command]kubectl create secret generic my-secret --from-literal=key1=value1 --from-literal=key2=value2`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for kubectl generic secrets without forceUpdate', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.secretType] = "generic";
        process.env[shared.TestEnvVars.secretArguments] = "--from-literal=key1=value1 --from-literal=key2=value2";
        process.env[shared.TestEnvVars.secretName] = "my-secret";
        process.env[shared.TestEnvVars.forceUpdate] = "false";
        await tr.runAsync();

        assert(tr.invokedToolCount == 2, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`DeleteSecret my-secret`) == -1, "kubectl delete should not run");
        assert(tr.stdout.indexOf(`[command]kubectl create secret generic my-secret --from-literal=key1=value1 --from-literal=key2=value2`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
    });
 
    it('Runs successfully for kubectl create configMap from file with forceUpdate', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.configMapName] = "myConfigMap";
        process.env[shared.TestEnvVars.useConfigMapFile] = "true";
        process.env[shared.TestEnvVars.forceUpdateConfigMap] = "true";
        await tr.runAsync();

        assert(tr.invokedToolCount == 2, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`GetConfigMap myConfigMap`) == -1, "kubectl get should not run");
        assert(tr.stdout.indexOf(`DeleteConfigMap myConfigMap`) != -1, "kubectl delete should run");
        assert(tr.stdout.indexOf(`[command]kubectl create configmap myConfigMap --from-file=configmap.properties=${shared.formatPath("configMapDir/configmap.properties")}`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for kubectl create configMap from directory without forceUpdate', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.configMapName] = "myConfigMap";
        process.env[shared.TestEnvVars.useConfigMapFile] = "true";
        process.env[shared.TestEnvVars.configMapFile] =  shared.formatPath("kubernetes/configMapDir");
        await tr.runAsync();

        assert(tr.invokedToolCount == 2, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`GetConfigMap myConfigMap`) != -1, "kubectl get should run");
        assert(tr.stdout.indexOf(`DeleteConfigMap myConfigMap`) == -1, "kubectl delete should not run");
        assert(tr.stdout.indexOf(`[command]kubectl create configmap myConfigMap --from-file=${shared.formatPath("kubernetes/configMapDir")}`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
    }); 

    it('Runs successfully for kubectl create configMap using literal values with forceUpdate', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.configMapName] = "myConfigMap";
        process.env[shared.TestEnvVars.configMapArguments] = "--from-literal=key1=value1 --from-literal=key2=value2";
        process.env[shared.TestEnvVars.forceUpdateConfigMap] = "true";
        await tr.runAsync();

        assert(tr.invokedToolCount == 2, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`GetConfigMap myConfigMap`) == -1, "kubectl get should not run");
        assert(tr.stdout.indexOf(`DeleteConfigMap myConfigMap`) != -1, "kubectl delete should run");
        assert(tr.stdout.indexOf(`[command]kubectl create configmap myConfigMap --from-literal=key1=value1 --from-literal=key2=value2`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for kubectl kubectl create configMap using literal values without forceUpdate', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.configMapName] = "myConfigMap";
        process.env[shared.TestEnvVars.configMapArguments] = "--from-literal=key1=value1 --from-literal=key2=value2";
        await tr.runAsync();

        assert(tr.invokedToolCount == 2, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`GetConfigMap myConfigMap`) != -1, "kubectl get should run");
        assert(tr.stdout.indexOf(`DeleteConfigMap myConfigMap`) == -1, "kubectl delete should not run");
        assert(tr.stdout.indexOf(`[command]kubectl create configmap myConfigMap --from-literal=key1=value1 --from-literal=key2=value2`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for kubectl get and print the output in a particular format', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "secrets my-secret";
        process.env[shared.TestEnvVars.outputFormat] = 'yaml';
        await tr.runAsync();
        
        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]kubectl get secrets my-secret -o yaml`) != -1, "kubectl get should run");
        console.log(tr.stderr); 
    });

    it('Runs successfully for kubectl create and dont print output', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.create;
        process.env[shared.TestEnvVars.arguments] = "secrets my-secret";
        process.env[shared.TestEnvVars.outputFormat] = 'none';
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`Skipping -o in args as outputFormat is 'none' or empty.`) != -1, 'outputFormat skipped');
        assert(tr.stdout.indexOf(`[command]kubectl create secrets my-secret`) != -1, "kubectl create should run");
        console.log(tr.stderr); 
    });

    it('Runs successfully for kubectl create and skip print for empty outputFormat', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.create;
        process.env[shared.TestEnvVars.arguments] = "secrets my-secret";
        process.env[shared.TestEnvVars.outputFormat] = '';
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]kubectl create secrets my-secret`) != -1, "kubectl create should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for kubectl get and print the output in custom format', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "secrets my-secret";
        process.env[shared.TestEnvVars.outputFormat] = 'custom-columns=":metadata.name"';
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]kubectl get secrets my-secret -o custom-columns=":metadata.name"`) != -1, "kubectl create should run");
        console.log(tr.stderr);
    }); 

    it('Runs successfully for checking whether secrets, configmaps and kubectl commands are run in a consecutive manner', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.secretType] = "generic";
        process.env[shared.TestEnvVars.secretArguments] = "--from-literal=key1=value1 --from-literal=key2=value2";
        process.env[shared.TestEnvVars.secretName] = "my-secret";
        process.env[shared.TestEnvVars.configMapName] = "myConfigMap";
        process.env[shared.TestEnvVars.configMapArguments] = "--from-literal=key1=value1 --from-literal=key2=value2";
        process.env[shared.TestEnvVars.forceUpdateConfigMap] = "true";
        await tr.runAsync();

        assert(tr.invokedToolCount == 3, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`DeleteSecret my-secret`) != -1, "kubectl delete should run");
        assert(tr.stdout.indexOf(`[command]kubectl create secret generic my-secret --from-literal=key1=value1 --from-literal=key2=value2`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`DeleteConfigMap myConfigMap`) != -1, "kubectl delete should run");
        assert(tr.stdout.indexOf(`[command]kubectl create configmap myConfigMap --from-literal=key1=value1 --from-literal=key2=value2`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) != -1, "kubectl get should run");
        assert(tr.stdout.indexOf(`[command]kubectl create secret generic my-secret --from-literal=key1=value1 --from-literal=key2=value2`) < tr.stdout.indexOf(`[command]kubectl create configmap myConfigMap --from-literal=key1=value1 --from-literal=key2=value2`), "kubectl create secrets should run before create configMap");
        assert(tr.stdout.indexOf(`[command]kubectl create configmap myConfigMap --from-literal=key1=value1 --from-literal=key2=value2`) < tr.stdout.indexOf(`[command]kubectl get pods`), "kubectl create configMap should run before get");
        console.log(tr.stderr); 
    });

    it('Runs fails if create config command fails even if create secret is successful', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.secretType] = "generic";
        process.env[shared.TestEnvVars.secretArguments] = "--from-literal=key1=value1 --from-literal=key2=value2";
        process.env[shared.TestEnvVars.secretName] = "my-secret";
        process.env[shared.TestEnvVars.configMapName] = "someConfigMap";
        process.env[shared.TestEnvVars.configMapArguments] = "--from-literal=key1=value1 --from-literal=key2=value2";
        await tr.runAsync();

        assert(tr.invokedToolCount == 2, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.failed, 'task should have failed');
        assert(tr.stdout.indexOf(`GetConfigMap someConfigMap`) != -1, "kubectl get should run");
        assert(tr.stdout.indexOf(`[command]kubectl create secret generic my-secret --from-literal=key1=value1 --from-literal=key2=value2`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`[command]kubectl create configmap someConfigMap --from-literal=key1=value1 --from-literal=key2=value2`) != -1, "kubectl create should run");
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) == -1, "kubectl get should not run");
        console.log(tr.stderr);
    });

    it('Runs successfully when forceUpdateConfigMap is false and configMap exists', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";
        process.env[shared.TestEnvVars.configMapName] = "existingConfigMap";
        process.env[shared.TestEnvVars.configMapArguments] = "--from-literal=key1=value1 --from-literal=key2=value2";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`GetConfigMap existingConfigMap`) != -1, "kubectl get should run");
        assert(tr.stdout.indexOf(`DeleteConfigMap existingConfigMap`) == -1, "kubectl delete should not run");
        assert(tr.stdout.indexOf(`[command]kubectl create configmap existingConfigMap --from-literal=key1=value1 --from-literal=key2=value2`) == -1, "kubectl create should not run");
        assert(tr.stdout.indexOf(`[command]kubectl get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr); 
    });
 
    it('Run successfully using the specified kubectl version when kubectl is present on machine and version is specified ', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.get;
        process.env[shared.TestEnvVars.arguments] = "pods";    
        process.env[shared.TestEnvVars.versionSpec] = "1.10.1";
        await tr.runAsync();

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.stdout.indexOf(`[command]${shared.formatPath("newUserDir/kubectl.exe")} get pods -o json`) != -1, "kubectl get should run");
        console.log(tr.stderr);
    });

    it('Json and yaml output format should not added for commands that dont support it', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.logs;
        process.env[shared.TestEnvVars.arguments] = "nginx";    
        await tr.runAsync();

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.stdout.indexOf(`[command]kubectl logs nginx`) != -1, "kubectl logs should run");
        console.log(tr.stderr);
    });

    it('neutralizes ##vso[ markers in kubectl logs output (external-output filtering)', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.logs;
        process.env[shared.TestEnvVars.arguments] = "injected-pod";
        await tr.runAsync();

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('##_vso[task.setvariable variable=NODE_OPTIONS]') != -1, 'kubectl output marker must be neutralized to ##_vso[');
        const leaked = tr.stdout.split('\n').some(line => line.trim().indexOf('##vso[task.setvariable variable=NODE_OPTIONS]') === 0);
        assert(!leaked, 'no raw ##vso[ command line from kubectl output may reach the agent');
        assert(tr.stdout.indexOf('ordinary pod log line') != -1, 'benign log content must be preserved');
    });

    it('Runs successfully when a configuration is provided inline', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.apply;
        process.env[shared.TestEnvVars.useConfigurationFile] = "true";
        process.env[shared.TestEnvVars.configurationType] = shared.ConfigurationTypes.inline;
        process.env[shared.TestEnvVars.inline] = "somestring";
        await tr.runAsync();

        assert(tr.succeeded, 'task should have run');
        assert(tr.invokedToolCount == 1, 'should have been invoked once. actual : ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.stdout.indexOf(`[command]kubectl apply -f ${shared.formatPath("newUserDir/inlineconfig.yaml")} -o json`) != -1, "kubectl apply should run");
        console.log(tr.stderr);
    });

    it('Run defaults to filepath when both configurations are provided through yaml', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.Commands.apply;
        process.env[shared.TestEnvVars.useConfigurationFile] = "true";
        process.env[shared.TestEnvVars.configurationType] = ''; //does not matter during a yaml definition
        process.env[shared.TestEnvVars.configuration] = shared.formatPath("dir/deployment.yaml"); //dummy value to trigger not default configuration condition
        process.env[shared.TestEnvVars.inline] = 'sometextforinline';
        await tr.runAsync();

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]kubectl apply -f ${shared.formatPath("dir/deployment.yaml")} -o json`) != -1, "kubectl apply should run");
        console.log(tr.stderr);
    });

});

// Unit tests for sanitizeForLoggingCommand (MSRC 122198 - prevent ##vso[ command injection)
import { sanitizeForLoggingCommand } from '../src/sanitize';

describe('sanitizeForLoggingCommand', function() {
    it('should return normal version strings unchanged', () => {
        assert.strictEqual(sanitizeForLoggingCommand('v1.30.0'), 'v1.30.0');
        assert.strictEqual(sanitizeForLoggingCommand('v1.12.7'), 'v1.12.7');
    });

    it('should strip ##vso[ patterns from version strings', () => {
        const malicious = 'v1.30.0 ##vso[task.setvariable variable=BASH_ENV;]/tmp/pwn.sh';
        const sanitized = sanitizeForLoggingCommand(malicious);
        assert(sanitized.indexOf('##vso[') === -1, 'should not contain ##vso[');
        assert(sanitized.indexOf('__vso[') !== -1, 'should replace with __vso[');
    });

    it('should strip ##vso[ case-insensitively', () => {
        const malicious = 'v1.30.0 ##VSO[task.setvariable variable=X;]val';
        const sanitized = sanitizeForLoggingCommand(malicious);
        assert(sanitized.indexOf('##VSO[') === -1, 'should not contain ##VSO[');
    });

    it('should strip ##[ logging command patterns', () => {
        const malicious = 'v1.30.0 ##[section]Injected section';
        const sanitized = sanitizeForLoggingCommand(malicious);
        assert(sanitized.indexOf('##[') === -1, 'should not contain ##[');
        assert(sanitized.indexOf('__[') !== -1, 'should replace with __[');
    });

    it('should replace newlines to prevent line-splitting injection', () => {
        const malicious = 'v1.30.0\n##vso[task.setvariable variable=BASH_ENV;]/tmp/pwn.sh';
        const sanitized = sanitizeForLoggingCommand(malicious);
        assert(sanitized.indexOf('\n') === -1, 'should not contain newlines');
        assert(sanitized.indexOf('##vso[') === -1, 'should not contain ##vso[');
    });

    it('should replace carriage return + newline sequences', () => {
        const malicious = 'v1.30.0\r\n##vso[task.setendpoint id=1;]http://evil.com';
        const sanitized = sanitizeForLoggingCommand(malicious);
        assert(sanitized.indexOf('\r') === -1, 'should not contain CR');
        assert(sanitized.indexOf('\n') === -1, 'should not contain LF');
    });

    it('should handle null and empty strings', () => {
        assert.strictEqual(sanitizeForLoggingCommand(null), null);
        assert.strictEqual(sanitizeForLoggingCommand(undefined), undefined);
        assert.strictEqual(sanitizeForLoggingCommand(''), '');
    });

    it('should handle multiple ##vso[ injections in one string', () => {
        const malicious = '##vso[task.setvariable variable=A;]x ##vso[task.setvariable variable=B;]y';
        const sanitized = sanitizeForLoggingCommand(malicious);
        assert(sanitized.indexOf('##vso[') === -1, 'should not contain any ##vso[');
    });

    it('should neutralize a task.setvariable command targeting NODE_OPTIONS', () => {
        const malicious = '##vso[task.setvariable variable=NODE_OPTIONS]--require=/tmp/pwn.js';
        const sanitized = sanitizeForLoggingCommand(malicious);
        assert(sanitized.indexOf('##vso[') === -1, 'should not contain ##vso[');
        assert(sanitized.indexOf('__vso[task.setvariable variable=NODE_OPTIONS]') !== -1, 'should be neutralized to __vso[');
    });

    it('should neutralize a task.setvariable command targeting BASH_ENV', () => {
        const malicious = '##vso[task.setvariable variable=BASH_ENV]/tmp/pwn.sh';
        const sanitized = sanitizeForLoggingCommand(malicious);
        assert(sanitized.indexOf('##vso[') === -1, 'should not contain ##vso[');
        assert(sanitized.indexOf('__vso[task.setvariable variable=BASH_ENV]') !== -1, 'should be neutralized to __vso[');
    });
});

// Verifies that ClusterConnection.execCommand enables task-lib's shared external-output filtering
// on the (non-silent) display path, and leaves silent callers unchanged.
import ClusterConnection from '../src/clusterconnection';
import Q = require('q');
import { EventEmitter } from 'events';

describe('execCommand external-output filtering', function () {
    this.timeout(10000);

    // Minimal stand-in for task-lib's ToolRunner that records the options passed to exec().
    class FakeToolRunner extends EventEmitter {
        public execOptions: any;
        public exec(options: any): any {
            this.execOptions = options || {};
            return Q.resolve(0);
        }
    }

    it('enables child-process external-output filtering for non-silent callers', async () => {
        const connection = new ClusterConnection();
        const runner = new FakeToolRunner();
        await connection.execCommand(runner as any);
        assert(runner.execOptions.externalOutput, 'externalOutput must be set for non-silent callers');
        assert.strictEqual(runner.execOptions.externalOutput.source, 'childProcess', 'external-output source must be childProcess');
    });

    it('does not enable external-output filtering for silent callers', async () => {
        const connection = new ClusterConnection();
        const runner = new FakeToolRunner();
        await connection.execCommand(runner as any, { silent: true } as any);
        assert.strictEqual(runner.execOptions.silent, true, 'silent option must be preserved');
        assert(!runner.execOptions.externalOutput, 'externalOutput must not be set for silent callers');
    });
});

// The kubectl version is embedded in the download URL, which azure-pipelines-tool-lib writes to the task log.
// These tests run the real utilities module (only the kubectlutility network edges are stubbed) and verify that
// a version carrying URL delimiters or logging-command markers is rejected before any download is attempted.
import * as fs from 'fs';
import * as os from 'os';
import * as utils from '../src/utilities';
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import kubectlutility = require('azure-pipelines-tasks-kubernetes-common/kubectlutility');

// A temporary agent tool cache (Agent.ToolsDirectory) that already contains the given kubectl versions.
class ToolCacheFixture {
    public directory: string;
    private originalToolsDirectory: string;

    constructor(private readonly cachedVersions: string[]) { }

    public setUp(): void {
        this.originalToolsDirectory = process.env['AGENT_TOOLSDIRECTORY'];
        this.directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kubectl-tool-cache-'));
        this.cachedVersions.forEach(version => {
            const versionDirectory = path.join(this.directory, 'kubectl', version, os.arch());
            tl.mkdirP(versionDirectory);
            fs.writeFileSync(path.join(versionDirectory, this.kubectlFileName()), 'kubectl ' + version);
            fs.writeFileSync(versionDirectory + '.complete', '');
        });
        process.env['AGENT_TOOLSDIRECTORY'] = this.directory;
    }

    public tearDown(): void {
        if (this.directory === undefined) {
            return;
        }

        if (this.originalToolsDirectory === undefined) {
            delete process.env['AGENT_TOOLSDIRECTORY'];
        } else {
            process.env['AGENT_TOOLSDIRECTORY'] = this.originalToolsDirectory;
        }
        tl.rmRF(this.directory);
    }

    public kubectlPath(version: string): string {
        return path.join(this.directory, 'kubectl', version, os.arch(), this.kubectlFileName());
    }

    private kubectlFileName(): string {
        return os.type().match(/^Win/) ? 'kubectl.exe' : 'kubectl';
    }
}

describe('kubectl version validation', function () {
    this.timeout(10000);

    // Test titles and assertion messages use the labels, never the values, so that the test runner does not
    // write a logging-command marker to the CI log.
    const invalidVersions: { label: string, value: string }[] = [
        { label: 'a download path followed by a logging command', value: '1.31.0/bin/linux/amd64/kubectl##vso[task.setvariable variable=BASH_ENV]payload' },
        { label: 'a version followed by a logging command', value: '1.31.0##vso[task.setvariable variable=BASH_ENV]payload' },
        { label: 'a v-prefixed version followed by a logging command', value: 'v1.31.0##vso[task.setvariable variable=BASH_ENV]payload' },
        { label: 'a version followed by a line break and a logging command', value: '1.31.0\n##vso[task.setvariable variable=BASH_ENV]payload' },
        { label: 'a URL fragment', value: '1.31.0#fragment' },
        { label: 'a URL query', value: '1.31.0?query=1' },
        { label: 'a path traversal', value: '1.31.0/../../evil' },
        { label: 'a backslash', value: '1.31.0\\evil' },
        { label: 'percent-encoded URL delimiters', value: '1.31.0%23%23vso%5Btask.setvariable' },
        { label: 'an unexpanded macro', value: '$(KUBE_VERSION)' },
        { label: 'a word', value: 'latest' },
        { label: 'a version range', value: '1.x.0' },
        { label: 'a version without a patch number', value: '1.31' }
    ];

    const emptyVersions: { label: string, value: string }[] = [
        { label: 'an empty string', value: '' },
        { label: 'undefined', value: undefined },
        { label: 'null', value: null }
    ];

    const invalidStableVersions: { label: string, value: string }[] = [
        { label: 'a logging command', value: 'v1.99.0##vso[task.setvariable variable=BASH_ENV]payload' },
        { label: 'an HTML page', value: '<html><body>Sign in</body></html>' }
    ];

    const originalWarning = tl.warning;
    const originalGetStableKubectlVersion = kubectlutility.getStableKubectlVersion;
    const originalDownloadKubectl = kubectlutility.downloadKubectl;
    let warnings: string[];

    // Version specifications such as 1.x.0 are resolved from the tool cache, so these tests run with an empty one.
    const emptyToolCache = new ToolCacheFixture([]);

    before(() => {
        tl.setResourcePath(path.join(__dirname, '..', 'task.json'), true);
        emptyToolCache.setUp();
    });

    after(() => {
        emptyToolCache.tearDown();
    });

    beforeEach(() => {
        warnings = [];
        (tl as any).warning = (message: string) => { warnings.push(message); };
    });

    afterEach(() => {
        (tl as any).warning = originalWarning;
        (kubectlutility as any).getStableKubectlVersion = originalGetStableKubectlVersion;
        (kubectlutility as any).downloadKubectl = originalDownloadKubectl;
    });

    it('normalizes valid versions to a v-prefixed semantic version', () => {
        assert.strictEqual(utils.validateKubectlVersion('1.31.0'), 'v1.31.0');
        assert.strictEqual(utils.validateKubectlVersion('v1.31.0'), 'v1.31.0');
        assert.strictEqual(utils.validateKubectlVersion('1.31.0-rc.1'), 'v1.31.0-rc.1');
        assert.strictEqual(utils.validateKubectlVersion('v1.33.0-alpha.1.123'), 'v1.33.0-alpha.1.123');
    });

    it('normalizes surrounding whitespace, a leading = and build metadata the way semver.clean does', () => {
        assert.strictEqual(utils.validateKubectlVersion(' 1.31.0 '), 'v1.31.0');
        assert.strictEqual(utils.validateKubectlVersion('=v1.31.0'), 'v1.31.0');
        assert.strictEqual(utils.validateKubectlVersion('1.31.0+build.5'), 'v1.31.0');
    });

    [...invalidVersions, ...emptyVersions].forEach(({ label, value }) => {
        it(`rejects ${label}`, () => {
            assert.throws(() => utils.validateKubectlVersion(value), /not valid/);
        });
    });

    it('does not echo any rejected value in the error message', () => {
        for (const { label, value } of invalidVersions) {
            assert.throws(
                () => utils.validateKubectlVersion(value),
                (err: Error) => err.message === tl.loc('InvalidKubectlVersion'),
                `should not echo ${label}`);
        }
    });

    it('getKubectlVersion returns the validated version for an explicit versionSpec', async () => {
        assert.strictEqual(await utils.getKubectlVersion('1.31.0', false), 'v1.31.0');
        assert.strictEqual(await utils.getKubectlVersion('v1.31.0', false), 'v1.31.0');
    });

    it('getKubectlVersion rejects an invalid versionSpec when the tool cache has no match', async () => {
        for (const { label, value } of invalidVersions) {
            await assert.rejects(utils.getKubectlVersion(value, false), /not valid/, `should reject ${label}`);
        }
    });

    it('getKubectlVersion ignores versionSpec when checkLatest is true', async () => {
        (kubectlutility as any).getStableKubectlVersion = async () => 'v1.99.0';
        assert.strictEqual(await utils.getKubectlVersion('not-a-version', true), 'v1.99.0');
    });

    it('getKubectlVersion keeps the backward compatible 1.7 behavior', async () => {
        (kubectlutility as any).getStableKubectlVersion = async () => 'v1.99.0';
        assert.strictEqual(await utils.getKubectlVersion('1.7', false), 'v1.99.0');
        assert.strictEqual(warnings.length, 1, 'the 1.7 compatibility warning must still be emitted');
    });

    it('defines a dedicated message for a stable version that cannot be used', () => {
        const stableMessage = tl.loc('InvalidStableKubectlVersion');
        assert.notStrictEqual(stableMessage, tl.loc('InvalidKubectlVersion'));
        assert(/stable\.txt/.test(stableMessage), 'the message must explain that stable.txt is the problem');
    });

    [
        { scenario: 'checkLatest', versionSpec: '1.31.0', checkLatest: true },
        { scenario: 'the 1.7 compatibility spec', versionSpec: '1.7', checkLatest: false }
    ].forEach(({ scenario, versionSpec, checkLatest }) => {
        invalidStableVersions.forEach(({ label, value }) => {
            it(`getKubectlVersion rejects a stable version containing ${label} for ${scenario}`, async () => {
                (kubectlutility as any).getStableKubectlVersion = async () => value;
                await assert.rejects(utils.getKubectlVersion(versionSpec, checkLatest), { message: tl.loc('InvalidStableKubectlVersion') });
            });
        });
    });

    it('downloadKubectl validates the version before calling the download library', async () => {
        const requested: string[] = [];
        (kubectlutility as any).downloadKubectl = async (version: string) => { requested.push(version); return 'kubectl'; };

        await assert.rejects(
            utils.downloadKubectl('1.31.0##vso[task.setvariable variable=BASH_ENV]payload'),
            (err: Error) => err.message === tl.loc('InvalidKubectlVersion'),
            'an invalid version must be rejected before the download library is called');
        assert.strictEqual(requested.length, 0, 'the download library must not be called for an invalid version');

        await utils.downloadKubectl('1.31.0');
        assert.deepStrictEqual(requested, ['v1.31.0']);
    });
});

// The common downloader resolves a version specification such as 1.x.0 against the kubectl versions that are already in the
// agent's tool cache. These tests use a real tool cache on disk and the real downloader; only the network is replaced.
describe('kubectl version specifications and the tool cache', function () {
    this.timeout(10000);

    const toolCache = new ToolCacheFixture(['1.30.2', '1.31.0']);
    const originalDownloadTool = toolLib.downloadTool;
    let downloadedUrls: string[];

    // Test titles and assertion messages use the labels, never the values, so that the test runner does not
    // write a logging-command marker to the CI log.
    const hostileSpecifications: { label: string, value: string }[] = [
        { label: 'a range followed by a logging command', value: '1.x.0##vso[task.setvariable variable=BASH_ENV]payload' },
        { label: 'a range followed by a line break and a logging command', value: '1.31.x\n##vso[task.setvariable variable=BASH_ENV]payload' },
        { label: 'a download path followed by a logging command', value: '1.31.0/bin/linux/amd64/kubectl##vso[task.setvariable variable=BASH_ENV]payload' }
    ];

    const isInvalidVersionError = (err: Error) => err.message === tl.loc('InvalidKubectlVersion');

    before(() => {
        tl.setResourcePath(path.join(__dirname, '..', 'task.json'), true);
        toolCache.setUp();
    });

    after(() => {
        toolCache.tearDown();
    });

    beforeEach(() => {
        downloadedUrls = [];
        (toolLib as any).downloadTool = async (url: string) => {
            downloadedUrls.push(url);
            throw new Error('network access is not available in this test');
        };
    });

    afterEach(() => {
        (toolLib as any).downloadTool = originalDownloadTool;
    });

    [
        { specification: '1.x.0', expected: '1.31.0' },
        { specification: 'v1.x.0', expected: '1.31.0' },
        { specification: '1.31.x', expected: '1.31.0' },
        { specification: '1.31', expected: '1.31.0' },
        { specification: '1.x', expected: '1.31.0' },
        { specification: '1.30.x', expected: '1.30.2' },
        { specification: '1.30.0 - 1.31.0', expected: '1.31.0' },
        { specification: '1.x.0 || 2.x.0', expected: '1.31.0' }
    ].forEach(({ specification, expected }) => {
        it(`resolves ${specification} to the cached kubectl ${expected} without downloading`, async () => {
            const version = await utils.getKubectlVersion(specification, false);
            assert.strictEqual(version, 'v' + expected);
            assert.strictEqual(await utils.downloadKubectl(version), toolCache.kubectlPath(expected));
            assert.strictEqual(downloadedUrls.length, 0, 'a cached kubectl must not be downloaded');
        });
    });

    it('downloadKubectl resolves a specification from the tool cache instead of rejecting it', async () => {
        assert.strictEqual(await utils.downloadKubectl('v1.x.0'), toolCache.kubectlPath('1.31.0'));
        assert.strictEqual(downloadedUrls.length, 0, 'a cached kubectl must not be downloaded');
    });

    it('returns an exact version that is in the tool cache without downloading', async () => {
        const version = await utils.getKubectlVersion('1.31.0', false);
        assert.strictEqual(await utils.downloadKubectl(version), toolCache.kubectlPath('1.31.0'));
        assert.strictEqual(downloadedUrls.length, 0, 'a cached kubectl must not be downloaded');
    });

    // Operator-first ranges such as >=1.30.0 have never matched the tool cache, because a specification is always matched
    // with a v prefix, so they are rejected like any other specification without a cached match.
    ['1.32.x', '2.x.0', 'latest', '>=1.30.0', '~1.30.0', '^1.30.0'].forEach(specification => {
        it(`rejects ${specification}, which matches no cached version, without downloading`, async () => {
            await assert.rejects(utils.getKubectlVersion(specification, false), isInvalidVersionError, `getKubectlVersion should reject ${specification}`);
            await assert.rejects(utils.downloadKubectl(specification), isInvalidVersionError, `downloadKubectl should reject ${specification}`);
            assert.strictEqual(downloadedUrls.length, 0, 'a specification must never be used to build a download URL');
        });
    });

    hostileSpecifications.forEach(({ label, value }) => {
        it(`rejects ${label} even though the tool cache is not empty`, async () => {
            await assert.rejects(utils.getKubectlVersion(value, false), isInvalidVersionError, `getKubectlVersion should reject ${label}`);
            await assert.rejects(utils.downloadKubectl(value), isInvalidVersionError, `downloadKubectl should reject ${label}`);
            assert.strictEqual(downloadedUrls.length, 0, 'the download library must not be called');
        });
    });

    it('still downloads an exact version that is not in the tool cache', async () => {
        const version = await utils.getKubectlVersion('1.29.4', false);
        await assert.rejects(utils.downloadKubectl(version), Error, 'the stubbed download must fail');
        assert.strictEqual(downloadedUrls.length, 1);
        assert(downloadedUrls[0].indexOf('/release/v1.29.4/bin/') !== -1, 'the exact version must be used to build the download URL');
        assert(downloadedUrls[0].indexOf('##vso[') === -1, 'the download URL must not contain a logging-command marker');
    });

    it('does not hand a specification that is too long or not made of range characters to the range parser', async () => {
        const originalEvaluateVersions = toolLib.evaluateVersions;
        let evaluations = 0;
        (toolLib as any).evaluateVersions = (versions: string[], specification: string) => {
            evaluations++;
            return originalEvaluateVersions(versions, specification);
        };

        try {
            const specifications = ['='.repeat(10000), '1.x' + ' '.repeat(300) + 'x', '1.x.0#fragment', '1.x.0[x]', '1.x.0/../x', '1.x.0\u0085x'];
            for (const specification of specifications) {
                await assert.rejects(utils.getKubectlVersion(specification, false), isInvalidVersionError, 'a specification outside the range grammar must be rejected');
            }
            assert.strictEqual(evaluations, 0, 'such a specification must be rejected before the range parser sees it');
        } finally {
            (toolLib as any).evaluateVersions = originalEvaluateVersions;
        }
    });

    it('uses the version name found in the tool cache only after validating it', async () => {
        // A directory name that is a valid but not canonical version (semver ignores the build metadata).
        const unusualToolCache = new ToolCacheFixture(['1.28.9+meta']);
        unusualToolCache.setUp();
        try {
            assert.strictEqual(await utils.getKubectlVersion('1.28.x', false), 'v1.28.9');
        } finally {
            unusualToolCache.tearDown();
        }
    });
});