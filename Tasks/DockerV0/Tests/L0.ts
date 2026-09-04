import * as os from "os";
import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tl = require('azure-pipelines-task-lib');
import * as shared from './TestShared';

describe('Docker Suite', function() {
    this.timeout(30000);
    before((done) => {
        process.env[shared.TestEnvVars.operatingSystem] = tl.getPlatform() === tl.Platform.Windows ? shared.OperatingSystems.Windows : shared.OperatingSystems.Other;
        done();
    });
    beforeEach(() => {
        delete process.env[shared.TestEnvVars.action];
        delete process.env[shared.TestEnvVars.containerType];
        delete process.env[shared.TestEnvVars.includeLatestTag];
        delete process.env[shared.TestEnvVars.qualifyImageName];
        delete process.env[shared.TestEnvVars.includeLatestTag];
        delete process.env[shared.TestEnvVars.imageName];
        delete process.env[shared.TestEnvVars.additionalImageTags];
        delete process.env[shared.TestEnvVars.enforceDockerNamingConvention];
        delete process.env[shared.TestEnvVars.memory];
        delete process.env[shared.TestEnvVars.addBaseImageData];
    });
    after(function () {
    });

    it('Runs successfully for docker build', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.ActionTypes.buildImage;
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("dir1/DockerFile")} -t test/test:2`) != -1, "docker build should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker build with memory limit', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.ActionTypes.buildImage;
        process.env[shared.TestEnvVars.memory] = "2GB";
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("dir1/DockerFile")} -t test/test:2 -m 2GB`) != -1, "docker build should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker build for invalid image name', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.ActionTypes.buildImage;
        process.env[shared.TestEnvVars.imageName] = 'test/Te st:2';
        process.env[shared.TestEnvVars.enforceDockerNamingConvention] = 'true';
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("dir1/DockerFile")} -t test/test:2`) != -1, "docker build should run");
        console.log(tr.stderr);
    });

    it('Runs fails for docker build for invalid image name and modify image name false', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.ActionTypes.buildImage;
        process.env[shared.TestEnvVars.imageName] = 'test/Te st:2';
        process.env[shared.TestEnvVars.enforceDockerNamingConvention] = 'false';
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 1 || tr.errorIssues.length, 'should have written to stderror');
        assert(tr.failed, 'task should have failed');
        assert(tr.stdout.indexOf(`test/Te st:2 not valid imagename`) != -1, "docker build should fail");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker build for invalid image name and additional image tag', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.ActionTypes.buildImage;
        process.env[shared.TestEnvVars.imageName] = 'test/Test:2';
        process.env[shared.TestEnvVars.additionalImageTags] = '6';
        process.env[shared.TestEnvVars.enforceDockerNamingConvention] = 'true';
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("dir1/DockerFile")} -t test/test:2`) != -1, "docker build should run");
        console.log(tr.stderr);
    });


    it('Runs successfully for docker build with latest tag', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.ActionTypes.buildImage;
        process.env[shared.TestEnvVars.includeLatestTag] = "true";
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("dir1/DockerFile")} -t test/test:2 -t test/test`) != -1, "docker build should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker run image', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.ActionTypes.runImage;
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf("[command]docker run --rm test/test:2") != -1, "docker run should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker run image with memory limit', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.ActionTypes.runImage;
        process.env[shared.TestEnvVars.memory] = "2GB";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf("[command]docker run --rm -m 2GB test/test:2") != -1, "docker run should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker tag image from image names file', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.ActionTypes.tagImages;
        process.env[shared.TestEnvVars.containerType] = shared.ContainerTypes.AzureContainerRegistry;
        process.env[shared.TestEnvVars.qualifyImageName] = "true";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker tag ${shared.ImageNamesFileImageName} ajgtestacr1.azurecr.io/${shared.ImageNamesFileImageName}:latest`) != -1, "docker tag should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker push image', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.ActionTypes.pushImage;
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf("[command]docker push test/test:2") != -1, "docker push should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker push image from image names file', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.ActionTypes.pushImages;
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker push ${shared.ImageNamesFileImageName}:latest`) != -1, "docker push should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker pull image', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.ActionTypes.dockerCommand;
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf("[command]docker pull test/test:2") != -1, "docker pull should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker build with ACR', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.ActionTypes.buildImage;
        process.env[shared.TestEnvVars.containerType] = shared.ContainerTypes.AzureContainerRegistry;
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("dir1/DockerFile")} -t test/test:2`) != -1, "docker build should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker build with ACR and qualify image name', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.ActionTypes.buildImage;
        process.env[shared.TestEnvVars.containerType] = shared.ContainerTypes.AzureContainerRegistry;
        process.env[shared.TestEnvVars.qualifyImageName] = "true";
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        await tr.runAsync();
        
        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("dir1/DockerFile")} -t ajgtestacr1.azurecr.io/test/test:2`) != -1, "docker build should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker build and populate ouput variable correctly', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.action] = shared.ActionTypes.buildImage;
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        await tr.runAsync();

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf("set DockerOutputPath=") != -1, "docker build should set DockerOutputPath env variable.")
        console.log(tr.stderr);
    });

    it('Docker build should store the id of the image that was built.', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.imageName] = "testuser/standardbuild:11";
        process.env[shared.TestEnvVars.action] = shared.ActionTypes.buildImage;
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf("set DOCKER_TASK_BUILT_IMAGES=c834e0094587") != -1, "docker build should have stored the image id.")
        console.log(tr.stderr);
    });

    it('Docker build should store the id of the image that was built with builkit.', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.imageName] = "testuser/buildkit:11";
        process.env[shared.TestEnvVars.action] = shared.ActionTypes.buildImage;
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf("set DOCKER_TASK_BUILT_IMAGES=6c3ada3eb420") != -1, "docker build should have stored the image id.")
        console.log(tr.stderr);
    });

    it('Docker build should add labels with base image info', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.imageName] = "testuser/imagewithannotations:11";
        process.env[shared.TestEnvVars.action] = shared.ActionTypes.buildImage;
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.invokedToolCount == 3, 'should have invoked tool three time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("dir1/DockerFile")} -t testuser/imagewithannotations:11 ${shared.DockerCommandArgs.BuildLabels} --label ${shared.BaseImageLabels.name} --label ${shared.BaseImageLabels.digest}`) != -1, "docker build should run");
        console.log(tr.stderr);
    });

    it('Docker build should store the id of the image that was built with builkit.', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.imageName] = "testuser/buildkit:11";
        process.env[shared.TestEnvVars.action] = shared.ActionTypes.buildImage;
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf("set DOCKER_TASK_BUILT_IMAGES=6c3ada3eb420") != -1, "docker build should have stored the image id.")
        console.log(tr.stderr);
    });
});
