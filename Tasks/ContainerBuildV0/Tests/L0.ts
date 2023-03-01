import * as path from "path";
import * as assert from "assert";
import * as ttm from "azure-pipelines-task-lib/mock-test";
import * as tl from "azure-pipelines-task-lib/task";
import * as dockerCommandUtils from "azure-pipelines-tasks-docker-common/dockercommandutils";
import * as pipelineutils from "azure-pipelines-tasks-docker-common/pipelineutils";
import * as shared from "./TestShared";
import ConsistentHashing = require("consistent-hashing");

describe("ContainerBuildV0 Suite", function () {
    this.timeout(30000);

    if (!tl.osType().match(/^Win/)) {
        return;
    }

    before((done) => {
        process.env[shared.TestEnvVars.operatingSystem] = tl.osType().match(/^Win/) ? shared.OperatingSystems.Windows : shared.OperatingSystems.Other;
        done();
    });
    
    beforeEach(() => {
        delete process.env[shared.TestEnvVars.runningOn];
        delete process.env[shared.TestEnvVars.dockerRegistryServiceConnection];
        delete process.env[shared.TestEnvVars.repository];
        delete process.env[shared.TestEnvVars.dockerFile];
        delete process.env[shared.TestEnvVars.buildContext];
        delete process.env[shared.TestEnvVars.tags];
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
        delete process.env['RUNNING_ON'];
    });

    // Docker build tests begin
    it('Runs successfully for docker build', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} -t testuser/testrepo:11 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for docker build with tags', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.tags] = "tag1";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} -t testuser/testrepo:tag1 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for docker build and push', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.dockerRegistryServiceConnection] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 2, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} -t testuser/testrepo:11 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:11`) != -1, "docker push should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for docker build and push with tags', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.dockerRegistryServiceConnection] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.tags] = "tag1";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 2, 'should have invoked tool two times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} -t testuser/testrepo:tag1 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:tag1`) != -1, "docker push should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for docker build and push with mutiple tags', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.dockerRegistryServiceConnection] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.tags] = "tag1\ntag2";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 3, 'should have invoked tool three times. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} -t testuser/testrepo:tag1 -t testuser/testrepo:tag2 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:tag1`) != -1, "docker push should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker push testuser/testrepo:tag2`) != -1, "docker push should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for docker build when registry other than Docker hub is used', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.dockerRegistryServiceConnection] = "acrendpoint";
        process.env[shared.TestEnvVars.repository] = "testrepo";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 2, 'should have invoked tool twice. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} -t testacr.azurecr.io/testrepo:11 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker push testacr.azurecr.io/testrepo:11`) != -1, "docker push should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for docker build when registry type is ACR and registry URL contains uppercase characters', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.dockerRegistryServiceConnection] = "acrendpoint2";
        process.env[shared.TestEnvVars.repository] = "testrepo";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 2, 'should have invoked tool twice. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} -t testacr2.azurecr.io/testrepo:11 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]docker push testacr2.azurecr.io/testrepo:11`) != -1, "docker push should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Docker build should honour Dockerfile and buildcontext input', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";   
        process.env[shared.TestEnvVars.dockerFile] = shared.formatPath("a/w/meta/Dockerfile");
        process.env[shared.TestEnvVars.buildContext] = shared.formatPath("a/w/context");
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/meta/Dockerfile")} -t testuser/testrepo:11 ${shared.formatPath("a/w/context")}`) != -1, "docker build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    //buildctl
    it('Buildctl should honour Dockerfile and buildcontext input', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env['RUNNING_ON'] = 'KUBERNETES';
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";   
        process.env[shared.TestEnvVars.dockerFile] = shared.formatPath("a/w/meta/Dockerfile");
        process.env[shared.TestEnvVars.buildContext] = shared.formatPath("a/w/context");
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]buildctl build --frontend=dockerfile.v0 --local=context=${shared.formatPath("a/w/context")} --local=dockerfile=${shared.formatPath("a/w/meta/")}`) != -1, "buildctl build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Buildctl should perform build as well as push if dockerregistryserviceconnect is present', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env['RUNNING_ON'] = 'KUBERNETES';
        process.env[shared.TestEnvVars.dockerRegistryServiceConnection] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";   
        process.env[shared.TestEnvVars.dockerFile] = shared.formatPath("a/w/meta/Dockerfile");
        process.env[shared.TestEnvVars.buildContext] = shared.formatPath("a/w/context");
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]buildctl build --frontend=dockerfile.v0 --local=context=${shared.formatPath("a/w/context")} --local=dockerfile=${shared.formatPath("a/w/meta/")} --exporter=image --exporter-opt=name=testuser/testrepo:11 --exporter-opt=push=true`) != -1, "buildctl build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for buildctl build and push with multiple tags', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env['RUNNING_ON'] = 'KUBERNETES';
        process.env[shared.TestEnvVars.dockerRegistryServiceConnection] = "dockerhubendpoint";
        process.env[shared.TestEnvVars.repository] = "testuser/testrepo";
        process.env[shared.TestEnvVars.tags] = "tag1\ntag2";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        //assert(tr.stdout.indexOf(`[command]docker build -f ${shared.formatPath("a/w/Dockerfile")} -t testuser/testrepo:tag1 ${shared.formatPath("a/w")}`) != -1, "docker build should run with expected arguments");
        assert(tr.stdout.indexOf(`[command]buildctl build --frontend=dockerfile.v0 --local=context=${shared.formatPath("a/w/**")} --local=dockerfile=${shared.formatPath("a/w/**/")} --exporter=image --exporter-opt=name=testuser/testrepo:tag1,testuser/testrepo:tag2 --exporter-opt=push=true`) != -1, "buildctl build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Runs successfully for buildctl build when registry other than Docker hub is used', (done:Mocha.Done) => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env['RUNNING_ON'] = 'KUBERNETES';
        process.env[shared.TestEnvVars.dockerRegistryServiceConnection] = "acrendpoint";
        process.env[shared.TestEnvVars.repository] = "testrepo";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool once. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]buildctl build --frontend=dockerfile.v0 --local=context=${shared.formatPath("a/w/**")} --local=dockerfile=${shared.formatPath("a/w/**/")} --exporter=image --exporter-opt=name=testacr.azurecr.io/testrepo:11 --exporter-opt=push=true`) != -1, "buildctl build should run with expected arguments");
        console.log(tr.stderr);
        done();
    });

    it('Consistent hash must be computed correctly', (done) => {
        var ring = new ConsistentHashing([]);
        ring.addNode("buildkitd-0");
        ring.addNode("buildkitd-1");
        ring.addNode("buildkitd-2");
        var chosenbuildkitpod = ring.getNode("testrepoF:\a\w\meta\Dockerfile");
        
        // can return different pod for different key
        assert(chosenbuildkitpod,"buildkitd-2");
        var chosenbuildkitpod1 = ring.getNode("testuser\testrepoF:\a\w\meta\Dockerfile");
        
        assert(chosenbuildkitpod1,"buildkitd-0");
       
        // must return same pod if same key given
        var chosenbuildkitpod3 = ring.getNode("testrepoF:\a\w\meta\Dockerfile");
        assert(chosenbuildkitpod3,"buildkitd-2");
        done();
    });

});
