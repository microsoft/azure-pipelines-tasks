import * as path from "path";
import * as assert from "assert";
import * as ttm from "azure-pipelines-task-lib/mock-test";
import * as tl from "azure-pipelines-task-lib/task";
import * as dockerCommandUtils from "docker-common-v2/dockercommandutils";
import * as shared from "./TestShared";

describe("DockerV2 Suite", function () {
    this.timeout(30000);

    if (!tl.osType().match(/^Win/)) {
        return;
    }

    before((done) => {
        process.env[shared.TestEnvVars.operatingSystem] = tl.osType().match(/^Win/) ? shared.OperatingSystems.Windows : shared.OperatingSystems.Other;
        done();
    });
    
    beforeEach(() => {
        delete process.env[shared.TestEnvVars.hostType];
        delete process.env[shared.TestEnvVars.containerRegistry];
        delete process.env[shared.TestEnvVars.repository];
        delete process.env[shared.TestEnvVars.command];
        delete process.env[shared.TestEnvVars.dockerFile];
        delete process.env[shared.TestEnvVars.buildContext];
        delete process.env[shared.TestEnvVars.tags];
        delete process.env[shared.TestEnvVars.arguments];
    });
    
    after(function () {
    });

    // Docker build tests begin
    it('Runs successfully for docker build', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.build;
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} ${shared.DockerCommandArgs.BuildLabels} -t testuser/testrepo:11 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });
    
    it('Runs successfully for docker build with release labels', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.build;
        process.env[shared.TestEnvVars.hostType] = shared.HostTypes.release;
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} ${shared.DockerCommandArgs.ReleaseLabels} -t testuser/testrepo:11 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for docker build when registry other than Docker hub is used', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "acrendpoint";
        process.env[shared.TestEnvVars.repository] = "testrepo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.build;
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} ${shared.DockerCommandArgs.BuildLabels} -t testacr.azurecr.io/testrepo:11 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for docker build without containerRegistry and repository inputs', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.build;
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} ${shared.DockerCommandArgs.BuildLabels} ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Docker build should honour Dockerfile input', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.build;        
        process.env[shared.TestEnvVars.dockerFile] = shared.formatPath("a/w/meta/Dockerfile");
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/meta/Dockerfile")} ${shared.DockerCommandArgs.BuildLabels} -t testuser/testrepo:11 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Docker build should honour buildContext input', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.build;        
        process.env[shared.TestEnvVars.buildContext] = shared.formatPath("a/w/context");
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} ${shared.DockerCommandArgs.BuildLabels} -t testuser/testrepo:11 ${shared.formatPath("a/w/context")}`) != -1, "docker build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Docker build should work correctly with multiple tags', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.build;        
        process.env[shared.TestEnvVars.tags] = "tag1\ntag2\ntag3";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} ${shared.DockerCommandArgs.BuildLabels} -t testuser/testrepo:tag1 -t testuser/testrepo:tag2 -t testuser/testrepo:tag3 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Docker build should honour arguments input', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.build;        
        process.env[shared.TestEnvVars.arguments] = "--rm --queit";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} ${shared.DockerCommandArgs.BuildLabels} --rm --queit -t testuser/testrepo:11 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Docker build should honour multiline arguments input', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.build;        
        process.env[shared.TestEnvVars.arguments] = "--rm\n--queit";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} ${shared.DockerCommandArgs.BuildLabels} --rm --queit -t testuser/testrepo:11 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Docker build should ensure that the image name follows the Docker naming conventions', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "Test User/TEST repo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.build;
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} ${shared.DockerCommandArgs.BuildLabels} -t testuser/testrepo:11 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });
    // Docker build tests end

    // Docker push tests begin
    it('Runs successfully for docker push', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.push;
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 2, 'should have invoked tool two times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:11`) != -1, "docker push should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}} --no-trunc testuser/testrepo:11`) != -1, "docker history should be invoked for the image");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for docker push when registry other than Docker hub is used', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "acrendpoint";
        process.env[shared.TestEnvVars.repository] = "testrepo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.push;
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 2, 'should have invoked tool two times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker push testacr.azurecr.io/testrepo:11`) != -1, "docker push should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}} --no-trunc testacr.azurecr.io/testrepo:11`) != -1, "docker history should be invoked for the image");
        console.log(tr.stderr);
        done();
    });

    it('Docker push should work with multiple tags', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.push;
        process.env[shared.TestEnvVars.tags] = "tag1\ntag2\ntag3";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 6, 'should have invoked tool six times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:tag1`) != -1, "docker push should have pushed tag1");
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:tag2`) != -1, "docker push should have pushed tag2");
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:tag3`) != -1, "docker push should have pushed tag3");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}} --no-trunc testuser/testrepo:tag1`) != -1, "docker history should be invoked for the image");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}} --no-trunc testuser/testrepo:tag2`) != -1, "docker history should be invoked for the image");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}} --no-trunc testuser/testrepo:tag3`) != -1, "docker history should be invoked for the image");
        console.log(tr.stderr);
        done();
    });

    it('Docker push should honour arguments input', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.push;
        process.env[shared.TestEnvVars.arguments] = "--disable-content-trust --arg2";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 2, 'should have invoked tool two times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:11 --disable-content-trust --arg2`) != -1, "docker push should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}} --no-trunc testuser/testrepo:11`) != -1, "docker history should be invoked for the image");
        console.log(tr.stderr);
        done();
    });

    it('Docker push should honour multiline arguments input', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.push;
        process.env[shared.TestEnvVars.arguments] = "--disable-content-trust\n--arg2";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 2, 'should have invoked tool two times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:11 --disable-content-trust --arg2`) != -1, "docker push should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}} --no-trunc testuser/testrepo:11`) != -1, "docker history should be invoked for the image");
        console.log(tr.stderr);
        done();
    });

    it('Docker push should work with multiple tags and honour multiline arguments input', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.push;
        process.env[shared.TestEnvVars.tags] = "tag1\ntag2\ntag3";
        process.env[shared.TestEnvVars.arguments] = "--disable-content-trust\n--arg2";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 6, 'should have invoked tool six times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:tag1 --disable-content-trust --arg2`) != -1, "docker push should have pushed tag1 with correct arguments");
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:tag2 --disable-content-trust --arg2`) != -1, "docker push should have pushed tag2 with correct arguments");
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:tag3 --disable-content-trust --arg2`) != -1, "docker push should have pushed tag2 with correct arguments");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}} --no-trunc testuser/testrepo:tag1`) != -1, "docker history should be invoked for the image");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}} --no-trunc testuser/testrepo:tag2`) != -1, "docker history should be invoked for the image");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}} --no-trunc testuser/testrepo:tag3`) != -1, "docker history should be invoked for the image");
        console.log(tr.stderr);
        done();
    });

    it('Docker push should ensure that the image name follows the Docker naming conventions', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "Test User/TEST repo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.push;
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 2, 'should have invoked tool two times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:11`) != -1, "docker push should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}} --no-trunc testuser/testrepo:11`) != -1, "docker history should be invoked for the image");
        console.log(tr.stderr);
        done();
    });
    // Docker push tests end

    // Docker buildAndPush tests begin
    it('Runs successfully for docker buildAndPush', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 3, 'should have invoked tool three times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} ${shared.DockerCommandArgs.BuildLabels} -t testuser/testrepo:11 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:11`) != -1, "docker push should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}} --no-trunc testuser/testrepo:11`) != -1, "docker history should be invoked for the image");
        console.log(tr.stderr);
        done();
    });

    it('Docker buildAndPush should honour Dockerfile input', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.dockerFile] = shared.formatPath("a/w/meta/Dockerfile");
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 3, 'should have invoked tool three times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/meta/Dockerfile")} ${shared.DockerCommandArgs.BuildLabels} -t testuser/testrepo:11 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:11`) != -1, "docker push should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}} --no-trunc testuser/testrepo:11`) != -1, "docker history should be invoked for the image");
        console.log(tr.stderr);
        done();
    });

    it('Docker buildAndPush should honour buildContext input', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.buildContext] = shared.formatPath("a/w/context");
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 3, 'should have invoked tool three times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} ${shared.DockerCommandArgs.BuildLabels} -t testuser/testrepo:11 ${shared.formatPath("a/w/context")}`) != -1, "docker build should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:11`) != -1, "docker push should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}} --no-trunc testuser/testrepo:11`) != -1, "docker history should be invoked for the image");
        console.log(tr.stderr);
        done();
    });

    it('Docker buildAndPush should work correctly with multiple tags', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.tags] = "tag1\ntag2\ntag3";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 7, 'should have invoked tool seven times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} ${shared.DockerCommandArgs.BuildLabels} -t testuser/testrepo:tag1 -t testuser/testrepo:tag2 -t testuser/testrepo:tag3 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:tag1`) != -1, "docker push should have pushed tag1");
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:tag2`) != -1, "docker push should have pushed tag2");
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:tag3`) != -1, "docker push should have pushed tag3");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}} --no-trunc testuser/testrepo:tag1`) != -1, "docker history should be invoked for the image");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}} --no-trunc testuser/testrepo:tag2`) != -1, "docker history should be invoked for the image");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}} --no-trunc testuser/testrepo:tag3`) != -1, "docker history should be invoked for the image");
        console.log(tr.stderr);
        done();
    });

    it('Docker buildAndPush should ignore arguments input', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.arguments] = "--rm --queit";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 3, 'should have invoked tool three times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} ${shared.DockerCommandArgs.BuildLabels} -t testuser/testrepo:11 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:11`) != -1, "docker push should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}} --no-trunc testuser/testrepo:11`) != -1, "docker history should be invoked for the image");
        console.log(tr.stderr);
        done();
    });
    // Docker buildAndPush tests end

    // Docker general command tests begin
    it('Runs successfully for docker images', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.images;
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker images`) != -1, "docker should be invoked");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for docker images with arguments', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.images;
        process.env[shared.TestEnvVars.arguments] = "--all --digests";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker images --all --digests`) != -1, "docker should be invoked with the correct arguments");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for docker images with multiline arguments', (done:MochaDone) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.images;
        process.env[shared.TestEnvVars.arguments] = "--all\n--digests";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker images --all --digests`) != -1, "docker should be invoked with the correct arguments");
        console.log(tr.stderr);
        done();
    });
    // Docker general command tests end

    // Other tests
    it("extractSizeInBytes should return correctly", (done: MochaDone) => {
        console.log("TestCaseName: extractSizeInBytes should return correctly");

        console.log("\n");

        const bitSize = "24.01B";
        const kbSize = "8.999KB";
        const mbSize = "23mb";
        const gbSize = "1.23GB";
        const tbSize = "1tb";

        let extractedSizeInBytes = dockerCommandUtils.extractSizeInBytes(bitSize);
        assert.equal(extractedSizeInBytes, 24.01, "extractSizeInBytes should return correctly for input in bytes");

        extractedSizeInBytes = dockerCommandUtils.extractSizeInBytes(kbSize);
        assert.equal(extractedSizeInBytes, (8.999 * 1024), "extractSizeInBytes should return correctly for input in kilobytes");

        extractedSizeInBytes = dockerCommandUtils.extractSizeInBytes(mbSize);
        assert.equal(extractedSizeInBytes, (23 * 1024 * 1024), "extractSizeInBytes should return correctly for input in megabytes");

        extractedSizeInBytes = dockerCommandUtils.extractSizeInBytes(gbSize);
        assert.equal(extractedSizeInBytes, (1.23 * 1024 * 1024 * 1024), "extractSizeInBytes should return correctly for input in gigabytes");

        extractedSizeInBytes = dockerCommandUtils.extractSizeInBytes(tbSize);
        assert.equal(extractedSizeInBytes, (1 * 1024 * 1024 * 1024 * 1024), "extractSizeInBytes should return correctly for input in terabytes");

        done();
    });

    it("getImageSize should return correctly for given layers", (done: MochaDone) => {
        console.log("TestCaseName: getImageSize should return correctly for given layers");

        console.log("\n");

        let layers: { [key: string]: string }[] = [];
        layers.push({ "directive": "dir1", "args": "args1", "createdOn": "10may", "size": "24.32kb" });
        layers.push({ "directive": "dir2", "args": "args2", "createdOn": "10may", "size": "0B" });
        layers.push({ "directive": "dir3", "args": "args3", "createdOn": "10may", "size": "7b" });
        layers.push({ "directive": "dir4", "args": "args4", "createdOn": "10may", "size": "7.77GB" });
        layers.push({ "directive": "dir5", "args": "args5", "createdOn": "10may", "size": "88.9MB" });

        const expectedSize = (24.32 * 1024) + (7) + (7.77 * 1024 * 1024 * 1024) + (88.9 * 1024 * 1024);
        const expectedSizeString = expectedSize.toString() + "B";

        const actualImageSize = dockerCommandUtils.getImageSize(layers);
        assert.equal(actualImageSize.indexOf(expectedSizeString), 0, "getImageSize should return correctly for given layers");
        assert.equal(actualImageSize.length, expectedSizeString.length, "getImageSize should return correctly for given layers");
        done();
    });
});
