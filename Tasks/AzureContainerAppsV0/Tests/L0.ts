import assert = require('assert')
import path = require('path')
import * as ttm from 'azure-pipelines-task-lib/mock-test'
import { Done } from 'mocha'

describe('AzureContainerAppsV0 Suite', function () {
    this.timeout(60000);

    function runValidations(validator: () => void, tr, done) {
        try {
            validator();
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    }

    it('Fails for neither appSourcePath or imageToDeploy arguments', (done: Done) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0FailsForNeitherAppSourcePathOrImageToDeploy.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.failed, 'AzureContainerAppsV0 task should have failed when neither appSourcePath or imageToDeploy arguments are provided.');
            assert(tr.stdout.includes('InvalidArgumentsMessage'), 'AzureContainerAppsV0 task should have failed when neither appSourcePath or imageToDeploy arguments are provided.');
        }, tr, done);
    });

    it('Fails for both appSourcePath and imageToDeploy arguments', (done: Done) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0FailsForBothAppSourcePathAndImageToDeploy.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.failed, 'AzureContainerAppsV0 task should have failed when both appSourcePath and imageToDeploy arguments are provided.');
            assert(tr.stdout.includes('InvalidArgumentsMessage'), 'AzureContainerAppsV0 task should have failed when both appSourcePath and imageToDeploy arguments are provided.');
        }, tr, done);
    });

    it('Fails for no service connection argument', (done: Done) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0FailsForNoServiceConnectionArgument.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.failed, 'AzureContainerAppsV0 task should have failed when no service connection argument is provided.');
            assert(tr.stdout.includes('Input required: connectedServiceNameARM'), 'AzureContainerAppsV0 task should have failed when no service connection argument is provided.');
        }, tr, done);
    });

    it('Fails for no ACR name argument', (done: Done) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0FailsForNoAcrNameArgument.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.failed, 'AzureContainerAppsV0 task should have failed when no ACR name argument is provided.');
            assert(tr.stdout.includes('Input required: acrName'), 'AzureContainerAppsV0 task should have failed when no ACR name argument is provided.');
        }, tr, done);
    });

    it('Succeeds for appSourcePath with bare minimum arguments', (done: Done) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0SucceedsForMinimumAppSourcePathArguments.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.succeeded, 'AzureContainerAppsV0 task should have succeeded when the minimum required arguments are provided.');
            assert(tr.stdout.includes('AcrAccessTokenLoginMessage'), 'AzureContainerAppsV0 task should use ACR access token for minimum appSourcePath run.');
            assert(tr.stdout.includes('CheckForAppSourceDockerfileMessage'), 'AzureContainerAppsV0 task should check for a root Dockerfile for minimum appSourcePath run.');
            assert(tr.stdout.includes('DefaultImageToBuildMessage'), 'AzureContainerAppsV0 task should set the default build image for minimum appSourcePath run.');
            assert(tr.stdout.includes('DefaultImageToDeployMessage'), 'AzureContainerAppsV0 task should set the default deploy image for minimum appSourcePath run.');
            assert(tr.stdout.includes('DefaultContainerAppNameMessage'), 'AzureContainerAppsV0 task should set the default Container App name for minimum appSourcePath run.');
            assert(tr.stdout.includes('DefaultResourceGroupMessage'), 'AzureContainerAppsV0 task should set the default resource group for minimum appSourcePath run.');
            assert(tr.stdout.includes('DefaultTargetPortMessage'), 'AzureContainerAppsV0 task should set the default target port for minimum appSourcePath run.');
            assert(tr.stdout.includes('DefaultRuntimeStackMessage'), 'AzureContainerAppsV0 task should check for the image runtime for minimum appSourcePath run.');
            assert(tr.stdout.includes('CreateImageWithBuilderMessage'), 'AzureContainerAppsV0 task should create image with builder for minimum appSourcePath run.');
        }, tr, done);
    });

    it('Succeeds for imageToDeploy with bare minimum arguments', (done: Done) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0SucceedsForMinimumImageToDeployArguments.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.succeeded, 'AzureContainerAppsV0 task should have succeeded when the minimum required arguments are provided.');
            assert(tr.stdout.includes('AcrAccessTokenLoginMessage'), 'AzureContainerAppsV0 task should use ACR access token for minimum imageToDeploy run.');
            assert(tr.stdout.includes('DefaultImageToBuildMessage'), 'AzureContainerAppsV0 task should set the default build image for minimum imageToDeploy run.');
            assert(tr.stdout.includes('DefaultContainerAppNameMessage'), 'AzureContainerAppsV0 task should set the default Container App name for minimum imageToDeploy run.');
            assert(tr.stdout.includes('DefaultResourceGroupMessage'), 'AzureContainerAppsV0 task should set the default resource group for minimum imageToDeploy run.');
            assert(tr.stdout.includes('DefaultTargetPortMessage'), 'AzureContainerAppsV0 task should set the default target port for minimum imageToDeploy run.');
        }, tr, done);
    });

    it('Succeeds for ACR credentials provided', (done: Done) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0SucceedsForAcrCredentials.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.succeeded, 'AzureContainerAppsV0 task should have succeeded when ACR credentials are provided.');
            assert(tr.stdout.includes('AcrUsernamePasswordLoginMessage'), 'AzureContainerAppsV0 task should use ACR credentials when provided.');
        }, tr, done);
    });
});