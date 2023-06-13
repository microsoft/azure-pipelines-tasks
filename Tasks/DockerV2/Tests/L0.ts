import * as path from "path";
import * as assert from "assert";
import * as ttm from "azure-pipelines-task-lib/mock-test";
import * as tl from "azure-pipelines-task-lib/task";
import * as dockerCommandUtils from "azure-pipelines-tasks-docker-common/dockercommandutils";
import * as pipelineutils from "azure-pipelines-tasks-docker-common/pipelineutils";
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
        delete process.env[shared.TestEnvVars.addPipelineData];
        delete process.env[shared.TestEnvVars.addBaseImageData];
    });

    after(function () {
        delete process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'];
        delete process.env['BUILD_SOURCEVERSION'];
        delete process.env['RELEASE_RELEASEID'];
        delete process.env['BUILD_REPOSITORY_URI'];
        delete process.env['BUILD_SOURCEBRANCHNAME'];
        delete process.env['BUILD_DEFINITIONNAME'];
        delete process.env['BUILD_BUILDNUMBER'];
        delete process.env['BUILD_BUILDURI'];
        delete process.env['SYSTEM_TEAMPROJECT'];
        delete process.env['BUILD_REPOSITORY_NAME'];
        delete process.env['RELEASE_DEFINITIONNAME'];
        delete process.env['RELEASE_RELEASEWEBURL'];
    });

    // Docker build tests begin
    it('Runs successfully for docker build', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.build;
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} ${shared.DockerCommandArgs.BuildLabels} -t testuser/testrepo:11 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for docker build with release labels', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.build;
        process.env[shared.TestEnvVars.hostType] = shared.HostTypes.release;
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} ${shared.DockerCommandArgs.ReleaseLabels} -t testuser/testrepo:11 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for docker build when registry other than Docker hub is used', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "acrendpoint";
        process.env[shared.TestEnvVars.repository] = "testrepo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.build;
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} ${shared.DockerCommandArgs.BuildLabels} -t testacr.azurecr.io/testrepo:11 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for docker build when registry type is ACR and registry URL contains uppercase characters', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "acrendpoint2";
        process.env[shared.TestEnvVars.repository] = "testrepo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.build;
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} ${shared.DockerCommandArgs.BuildLabels} -t testacr2.azurecr.io/testrepo:11 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Log in with Managed Identity', function (done: Mocha.Done) {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "acrendpoint3";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.login;
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert.equal(tr.succeeded, true, 'should have passed');
        assert.equal(tr.warningIssues.length, 0, "should have no warnings");
        assert.equal(tr.errorIssues.length, 0, "should have no error issue");
        console.log();
        done();
    });

    it('Runs successfully for docker build with repository input but without containerRegistry input', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.build;
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} ${shared.DockerCommandArgs.BuildLabels} -t testuser/testrepo:11 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for docker build without containerRegistry and repository inputs', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.build;
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} ${shared.DockerCommandArgs.BuildLabels} ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Docker build should honour Dockerfile input', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.build;
        process.env[shared.TestEnvVars.dockerFile] = shared.formatPath("a/w/meta/Dockerfile");
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/meta/Dockerfile")} ${shared.DockerCommandArgs.BuildLabels} -t testuser/testrepo:11 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Docker build should honour buildContext input', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.build;
        process.env[shared.TestEnvVars.buildContext] = shared.formatPath("a/w/context");
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} ${shared.DockerCommandArgs.BuildLabels} -t testuser/testrepo:11 ${shared.formatPath("a/w/context")}`) != -1, "docker build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Docker build should work correctly with multiple tags', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.build;
        process.env[shared.TestEnvVars.tags] = "tag1,tag2\ntag3";
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} ${shared.DockerCommandArgs.BuildLabels} -t testuser/testrepo:tag1 -t testuser/testrepo:tag2 -t testuser/testrepo:tag3 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Docker build should honour arguments input', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.build;
        process.env[shared.TestEnvVars.arguments] = "--rm --queit";
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} ${shared.DockerCommandArgs.BuildLabels} --rm --queit -t testuser/testrepo:11 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Docker build should honour multiline arguments input', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.build;
        process.env[shared.TestEnvVars.arguments] = "--rm\n--queit";
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} ${shared.DockerCommandArgs.BuildLabels} --rm --queit -t testuser/testrepo:11 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Docker build should ensure that the image name follows the Docker naming conventions', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "Test User/TEST repo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.build;
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} ${shared.DockerCommandArgs.BuildLabels} -t testuser/testrepo:11 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Docker build should store the id of the image that was built.', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/standardbuild";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.build;
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf("set DOCKER_TASK_BUILT_IMAGES=c834e0094587") != -1, "docker build should have stored the image id.")
        console.log(tr.stderr);
        done();
    });

    it('Docker build should store the id of the image that was built with builkit.', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/buildkit";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.build;
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf("set DOCKER_TASK_BUILT_IMAGES=6c3ada3eb420") != -1, "docker build should have stored the image id.")
        console.log(tr.stderr);
        done();
    });

    it('Docker build should add labels with base image info', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.repository] = "testuser/imagewithannotations";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.build;
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 3, 'should have invoked tool three times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} ${shared.DockerCommandArgs.BuildLabelsWithImageAnnotation} -t testuser/imagewithannotations:11 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Docker build should add labels with base image info for multistage builds', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.repository] = "testuser/dockermultistage";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.build;
        process.env[shared.TestEnvVars.dockerFile] = shared.formatPath("a/w/multistage/Dockerfile");
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 3, 'should have invoked tool three times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/multistage/Dockerfile")} ${shared.DockerCommandArgs.BuildLabelsWithImageAnnotation} -t testuser/dockermultistage:11 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    // // Docker build tests end

    // // Docker push tests begin
    it('Runs successfully for docker push', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.push;
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 3, 'should have invoked tool three times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:11`) != -1, "docker push should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}}; layerId:{{.ID}} --no-trunc testuser/testrepo:11`) != -1, "docker history should be invoked for the image");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for docker push when registry other than Docker hub is used', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "acrendpoint";
        process.env[shared.TestEnvVars.repository] = "testrepo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.push;
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 3, 'should have invoked tool three times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker push testacr.azurecr.io/testrepo:11`) != -1, "docker push should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}}; layerId:{{.ID}} --no-trunc testacr.azurecr.io/testrepo:11`) != -1, "docker history should be invoked for the image");
        console.log(tr.stderr);
        done();
    });

    it('Docker push should work with multiple tags', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.push;
        process.env[shared.TestEnvVars.tags] = "tag1\ntag2,tag3";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 7, 'should have invoked tool seven times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:tag1`) != -1, "docker push should have pushed tag1");
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:tag2`) != -1, "docker push should have pushed tag2");
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:tag3`) != -1, "docker push should have pushed tag3");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}}; layerId:{{.ID}} --no-trunc testuser/testrepo:tag1`) != -1, "docker history should be invoked for the image");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}}; layerId:{{.ID}} --no-trunc testuser/testrepo:tag2`) != -1, "docker history should be invoked for the image");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}}; layerId:{{.ID}} --no-trunc testuser/testrepo:tag3`) != -1, "docker history should be invoked for the image");
        console.log(tr.stderr);
        done();
    });

    it('Docker push should work with multiple ill formed tags', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.push;
        process.env[shared.TestEnvVars.tags] = "tag1,\ntag2,,tag3";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 7, 'should have invoked tool seven times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:tag1`) != -1, "docker push should have pushed tag1");
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:tag2`) != -1, "docker push should have pushed tag2");
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:tag3`) != -1, "docker push should have pushed tag3");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}}; layerId:{{.ID}} --no-trunc testuser/testrepo:tag1`) != -1, "docker history should be invoked for the image");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}}; layerId:{{.ID}} --no-trunc testuser/testrepo:tag2`) != -1, "docker history should be invoked for the image");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}}; layerId:{{.ID}} --no-trunc testuser/testrepo:tag3`) != -1, "docker history should be invoked for the image");
        console.log(tr.stderr);
        done();
    });

    it('Docker push should honour arguments input', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.push;
        process.env[shared.TestEnvVars.arguments] = "--disable-content-trust --arg2";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 3, 'should have invoked tool three times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:11 --disable-content-trust --arg2`) != -1, "docker push should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}}; layerId:{{.ID}} --no-trunc testuser/testrepo:11`) != -1, "docker history should be invoked for the image");
        console.log(tr.stderr);
        done();
    });

    it('Docker push should honour multiline arguments input', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.push;
        process.env[shared.TestEnvVars.arguments] = "--disable-content-trust\n--arg2";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 3, 'should have invoked tool three times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:11 --disable-content-trust --arg2`) != -1, "docker push should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}}; layerId:{{.ID}} --no-trunc testuser/testrepo:11`) != -1, "docker history should be invoked for the image");
        console.log(tr.stderr);
        done();
    });

    it('Docker push should work with multiple tags and honour multiline arguments input', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.push;
        process.env[shared.TestEnvVars.tags] = "tag1\ntag2\ntag3";
        process.env[shared.TestEnvVars.arguments] = "--disable-content-trust\n--arg2";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 7, 'should have invoked tool seven times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:tag1 --disable-content-trust --arg2`) != -1, "docker push should have pushed tag1 with correct arguments");
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:tag2 --disable-content-trust --arg2`) != -1, "docker push should have pushed tag2 with correct arguments");
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:tag3 --disable-content-trust --arg2`) != -1, "docker push should have pushed tag2 with correct arguments");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}}; layerId:{{.ID}} --no-trunc testuser/testrepo:tag1`) != -1, "docker history should be invoked for the image");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}}; layerId:{{.ID}} --no-trunc testuser/testrepo:tag2`) != -1, "docker history should be invoked for the image");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}}; layerId:{{.ID}} --no-trunc testuser/testrepo:tag3`) != -1, "docker history should be invoked for the image");
        console.log(tr.stderr);
        done();
    });

    it('Docker push should ensure that the image name follows the Docker naming conventions', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "Test User/TEST repo";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.push;
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 3, 'should have invoked tool three times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:11`) != -1, "docker push should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}}; layerId:{{.ID}} --no-trunc testuser/testrepo:11`) != -1, "docker history should be invoked for the image");
        console.log(tr.stderr);
        done();
    });
    // // Docker push tests end

    // // Docker buildAndPush tests begin
    it('Runs successfully for docker buildAndPush', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        tr.run();

        assert(tr.invokedToolCount == 4, 'should have invoked tool four times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} ${shared.DockerCommandArgs.BuildLabels} -t testuser/testrepo:11 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:11`) != -1, "docker push should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}}; layerId:{{.ID}} --no-trunc testuser/testrepo:11`) != -1, "docker history should be invoked for the image");
        console.log(tr.stderr);
        done();
    });

    it('Docker buildAndPush should honour Dockerfile input', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.dockerFile] = shared.formatPath("a/w/meta/Dockerfile");
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        tr.run();

        assert(tr.invokedToolCount == 4, 'should have invoked tool four times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/meta/Dockerfile")} ${shared.DockerCommandArgs.BuildLabels} -t testuser/testrepo:11 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:11`) != -1, "docker push should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}}; layerId:{{.ID}} --no-trunc testuser/testrepo:11`) != -1, "docker history should be invoked for the image");
        console.log(tr.stderr);
        done();
    });

    it('Docker buildAndPush should honour buildContext input', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.buildContext] = shared.formatPath("a/w/context");
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        tr.run();

        assert(tr.invokedToolCount == 4, 'should have invoked tool four times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} ${shared.DockerCommandArgs.BuildLabels} -t testuser/testrepo:11 ${shared.formatPath("a/w/context")}`) != -1, "docker build should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:11`) != -1, "docker push should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}}; layerId:{{.ID}} --no-trunc testuser/testrepo:11`) != -1, "docker history should be invoked for the image");
        console.log(tr.stderr);
        done();
    });

    it('Docker buildAndPush should work correctly with multiple tags', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.tags] = "tag1\ntag2,tag3";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        tr.run();

        assert(tr.invokedToolCount == 8, 'should have invoked tool eight times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} ${shared.DockerCommandArgs.BuildLabels} -t testuser/testrepo:tag1 -t testuser/testrepo:tag2 -t testuser/testrepo:tag3 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:tag1`) != -1, "docker push should have pushed tag1");
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:tag2`) != -1, "docker push should have pushed tag2");
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:tag3`) != -1, "docker push should have pushed tag3");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}}; layerId:{{.ID}} --no-trunc testuser/testrepo:tag1`) != -1, "docker history should be invoked for the image");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}}; layerId:{{.ID}} --no-trunc testuser/testrepo:tag2`) != -1, "docker history should be invoked for the image");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}}; layerId:{{.ID}} --no-trunc testuser/testrepo:tag3`) != -1, "docker history should be invoked for the image");
        console.log(tr.stderr);
        done();
    });

    it('Docker buildAndPush should ignore arguments input', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.arguments] = "--rm --queit";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        tr.run();

        assert(tr.invokedToolCount == 4, 'should have invoked tool four times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} ${shared.DockerCommandArgs.BuildLabels} -t testuser/testrepo:11 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:11`) != -1, "docker push should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker history --format createdAt:{{.CreatedAt}}; layerSize:{{.Size}}; createdBy:{{.CreatedBy}}; layerId:{{.ID}} --no-trunc testuser/testrepo:11`) != -1, "docker history should be invoked for the image");
        console.log(tr.stderr);
        done();
    });
    // // Docker buildAndPush tests end

    // // Docker general command tests begin
    it('Runs successfully for docker images', (done:Mocha.Done) => {
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

    it('Runs successfully for docker images with arguments', (done:Mocha.Done) => {
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

    it('Runs successfully for docker images with multiline arguments', (done:Mocha.Done) => {
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

    it('Docker start should start container', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.start;
        process.env[shared.TestEnvVars.container] = "test_container";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker start some_container_id`) != -1, "docker should be invoked with the correct arguments");
        console.log(tr.stderr);
        done();
    });

    it('Docker start should start unregistered container', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.start;
        process.env[shared.TestEnvVars.container] = "unregistered_container";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker start unregistered_container`) != -1, "docker should be invoked with the correct arguments");
        console.log(tr.stderr);
        done();
    });

    it('Docker stop should stop container', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.stop;
        process.env[shared.TestEnvVars.container] = "test_container";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker stop some_container_id`) != -1, "docker should be invoked with the correct arguments");
        console.log(tr.stderr);
        done();
    });
    // Docker general command tests end

    // Other tests
    it("extractSizeInBytes should return correctly", (done: Mocha.Done) => {
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

    it("getImageSize should return correctly for given layers", (done: Mocha.Done) => {
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

    it("getDefaultLabels returns all labels when addPipelineData is true", (done: Mocha.Done) => {
        console.log("TestCaseName: getDefaultLabels returns all labels when addPipelineData is true");
        console.log("\n");

        setEnvironmentVariables();
        process.env['SYSTEM_HOSTTYPE'] = 'build';
        const labels = pipelineutils.getDefaultLabels(true);

        // update the label count in assert when newer labels are added
        assert.equal(labels.length, 9, "All labels are returned by default");
        done();
    });

    // it("Runs successfully for docker build selected labels when addPipelineData is false", (done: Mocha.Done) => {
    //     let tp = path.join(__dirname, 'TestSetup.js');
    //     process.env[shared.TestEnvVars.containerRegistry] = "dockerhubendpoint";
    //     process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
    //     process.env[shared.TestEnvVars.command] = shared.CommandTypes.build;
    //     process.env[shared.TestEnvVars.addPipelineData] = "false";
    //     let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
    //     tr.run();

    //     assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
    //     assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
    //     assert(tr.succeeded, 'task should have succeeded');
    //     assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} ${shared.DockerCommandArgs.BuildLabelsWithAddPipelineFalse} -t testuser/testrepo:11 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
    //     done();
    // });

    function setEnvironmentVariables() : void {
        process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] = 'https://mock.ms/mock/';
        process.env['BUILD_SOURCEVERSION'] = 'buildId';
        process.env['RELEASE_RELEASEID'] = 'realeaseId';
        process.env['BUILD_REPOSITORY_URI'] = 'https://mock.ms/mock/';
        process.env['BUILD_SOURCEBRANCHNAME'] = "some string";
        process.env['BUILD_DEFINITIONNAME'] = "some string";
        process.env['BUILD_BUILDNUMBER'] = "some string";
        process.env['BUILD_BUILDURI'] = 'https://mock.ms/mock/';
        process.env['SYSTEM_TEAMPROJECT'] = "some string";
        process.env['BUILD_REPOSITORY_NAME'] = "some string";
        process.env['RELEASE_DEFINITIONNAME'] = "some string";
        process.env['RELEASE_RELEASEWEBURL'] = 'https://mock.ms/mock/';
    }
});
