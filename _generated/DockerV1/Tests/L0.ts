import * as path from 'path';
import * as os from "os";
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
        delete process.env[shared.TestEnvVars.command];
        delete process.env[shared.TestEnvVars.containerType];
        delete process.env[shared.TestEnvVars.includeLatestTag];
        delete process.env[shared.TestEnvVars.qualifyImageName];
        delete process.env[shared.TestEnvVars.includeLatestTag];
        delete process.env[shared.TestEnvVars.imageName];
        delete process.env[shared.TestEnvVars.enforceDockerNamingConvention];
        delete process.env[shared.TestEnvVars.memoryLimit];
        delete process.env[shared.TestEnvVars.pushMultipleImages];
        delete process.env[shared.TestEnvVars.tagMultipleImages];
        delete process.env[shared.TestEnvVars.arguments];
        delete process.env[shared.TestEnvVars.qualifySourceImageName];
        delete process.env[shared.TestEnvVars.addBaseImageData];
    });
    after(function () {
    });

    it('Runs successfully for docker build', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.buildImage;
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("dir1/DockerFile")} ${shared.DockerCommandArgs.BuildLabels} -t test/test:2`) != -1, "docker build should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker build with memory limit', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.buildImage;
        process.env[shared.TestEnvVars.memoryLimit] = "2GB";
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("dir1/DockerFile")} ${shared.DockerCommandArgs.BuildLabels} -t test/test:2 -m 2GB`) != -1, "docker build should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker build for invalid image name', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.buildImage;
        process.env[shared.TestEnvVars.imageName] = 'test/Te st:2';
        process.env[shared.TestEnvVars.enforceDockerNamingConvention] = 'true';
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("dir1/DockerFile")} ${shared.DockerCommandArgs.BuildLabels} -t test/test:2`) != -1, "docker build should run");
        console.log(tr.stderr);
    });

    it('Runs fails for docker build for invalid image name and modify image name false', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.buildImage;
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
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.buildImage;
        process.env[shared.TestEnvVars.imageName] = 'test/Test:2';
        process.env[shared.TestEnvVars.enforceDockerNamingConvention] = 'true';
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("dir1/DockerFile")} ${shared.DockerCommandArgs.BuildLabels} -t test/test:2`) != -1, "docker build should run");
        console.log(tr.stderr);
    });


    it('Runs successfully for docker build with latest tag', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.buildImage;
        process.env[shared.TestEnvVars.includeLatestTag] = "true";
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("dir1/DockerFile")} ${shared.DockerCommandArgs.BuildLabels} -t test/test:2 -t test/test`) != -1, "docker build should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker build with arguments', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.buildImage;
        process.env[shared.TestEnvVars.arguments] = "-t test:testtag";
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("dir1/DockerFile")} ${shared.DockerCommandArgs.BuildLabels} -t test:testtag -t test/test:2`) != -1, "docker build should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker build with multiline arguments', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.buildImage;
        process.env[shared.TestEnvVars.arguments] = "-t test:tag1\n-t test:tag2\n-t test:tag3";
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("dir1/DockerFile")} ${shared.DockerCommandArgs.BuildLabels} -t test:tag1 -t test:tag2 -t test:tag3 -t test/test:2`) != -1, "docker build should run with correct arguments");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker run image', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.runImage;
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf("[command]docker run --rm test/test:2") != -1, "docker run should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker run image with multiline arguments', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.runImage;
        process.env[shared.TestEnvVars.arguments] = "-it\n-d\n-m 300M";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf("[command]docker run -it -d -m 300M --rm test/test:2") != -1, "docker run should run with correct arguments");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker run image with memory limit', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.runImage;
        process.env[shared.TestEnvVars.memoryLimit] = "2GB";
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
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.tagImages;
        process.env[shared.TestEnvVars.containerType] = shared.ContainerTypes.AzureContainerRegistry;
        process.env[shared.TestEnvVars.qualifyImageName] = "true";
        process.env[shared.TestEnvVars.tagMultipleImages] = "true";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker tag ${shared.ImageNamesFileImageName} ajgtestacr1.azurecr.io/${shared.ImageNamesFileImageName}`) != -1, "docker tag should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker tag image', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.tagImages;
        process.env[shared.TestEnvVars.containerType] = shared.ContainerTypes.AzureContainerRegistry;
        process.env[shared.TestEnvVars.qualifyImageName] = "true";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker tag test/test:2 ajgtestacr1.azurecr.io/test/test:2`) != -1, "docker tag should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker tag image with sourcequalify set to true', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.tagImages;
        process.env[shared.TestEnvVars.containerType] = shared.ContainerTypes.AzureContainerRegistry;
        process.env[shared.TestEnvVars.qualifyImageName] = "true";
        process.env[shared.TestEnvVars.qualifySourceImageName] = "true";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker tag ajgtestacr1.azurecr.io/test/test:2 ajgtestacr1.azurecr.io/test/test:2`) != -1, "docker tag should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker tag command with arguments', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.tagImages;
        process.env[shared.TestEnvVars.imageName] = 'test/test:latest';
        process.env[shared.TestEnvVars.arguments] = 'test/test:v1';
        await tr.runAsync();

        assert(tr.invokedToolCount == 2, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker tag test/test:latest test/test:v1`) != -1, "docker tag should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker push image', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.pushImage;
        await tr.runAsync();

        assert(tr.invokedToolCount == 2, 'should have invoked tool two times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf("[command]docker push test/test:2") != -1, "docker push should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker push image with arguments', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.pushImage;
        process.env[shared.TestEnvVars.arguments] = "-t testtag:testimage";
        await tr.runAsync();

        assert(tr.invokedToolCount == 2, 'should have invoked tool two times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf("[command]docker push test/test:2 -t testtag:testimage") != -1, "docker push should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker push image with multiline arguments', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.pushImage;
        process.env[shared.TestEnvVars.arguments] = "-t testtag:testimage\n--disable-content-trust";
        await tr.runAsync();

        assert(tr.invokedToolCount == 2, 'should have invoked tool two times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf("[command]docker push test/test:2 -t testtag:testimage --disable-content-trust") != -1, "docker push should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker push image from image names file', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.pushImage;
        process.env[shared.TestEnvVars.pushMultipleImages] = "true";
        await tr.runAsync();

        assert(tr.invokedToolCount == 2, 'should have invoked tool two times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker push ${shared.ImageNamesFileImageName}`) != -1, "docker push should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker pull image', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = "pull";
        process.env[shared.TestEnvVars.arguments] = "test/test:2";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf("[command]docker pull test/test:2") != -1, "docker pull should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker pull image with multiline arguments', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = "pull";
        process.env[shared.TestEnvVars.arguments] = "test/test:2\n--platform\n--disable-content-trust";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf("[command]docker pull test/test:2 --platform --disable-content-trust") != -1, "docker pull should run with correct multiline arguments");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker build with ACR', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.buildImage;
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        process.env[shared.TestEnvVars.containerType] = shared.ContainerTypes.AzureContainerRegistry;
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("dir1/DockerFile")} ${shared.DockerCommandArgs.BuildLabels} -t test/test:2`) != -1, "docker build should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker build with ACR and qualify image name', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.buildImage;
        process.env[shared.TestEnvVars.containerType] = shared.ContainerTypes.AzureContainerRegistry;
        process.env[shared.TestEnvVars.qualifyImageName] = "true";
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        await tr.runAsync();
        
        //console.log(tr.stdout);

        assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("dir1/DockerFile")} ${shared.DockerCommandArgs.BuildLabels} -t ajgtestacr1.azurecr.io/test/test:2`) != -1, "docker build should run");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker build and populate ouput variable correctly', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.buildImage;
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        await tr.runAsync();

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf("set DockerOutputPath=") != -1, "docker build should set DockerOutputPath env variable.")
        console.log(tr.stderr);
    });

    it('Docker build should store the id of the image that was built.', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.imageName] = "testuser/standardbuild:11";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.buildImage;
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
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.buildImage;
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf("set DOCKER_TASK_BUILT_IMAGES=6c3ada3eb420") != -1, "docker build should have stored the image id.");
        console.log(tr.stderr);
    });
    
    it('Docker build should add labels with base image info', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.imageName] = "testuser/imagewithannotations:11";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.buildImage;
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.invokedToolCount == 3, 'should have invoked tool three time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("dir1/DockerFile")} ${shared.DockerCommandArgs.BuildLabels} --label ${shared.BaseImageLabels.name} --label ${shared.BaseImageLabels.digest} -t testuser/imagewithannotations:11`) != -1, "docker build should run");
        console.log(tr.stderr);
    });
});
