import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tl = require('azure-pipelines-task-lib');

describe('Docker Compose Suite', function() {
    this.timeout(30000);
    before((done) => {
        done();
    });
     beforeEach(() => {
        delete process.env["__command__"];
        delete process.env["__container_type__"];
        delete process.env["__qualifyImageNames__"];
        delete process.env["__additionalDockerComposeFiles__"];
        delete process.env["__composeFilePath__"];
        delete process.env["__dockerComposeCommand__"];
        delete process.env["__arguments__"];
        delete process.env["__dockerComposePath__"];
    });
    after(function () {
    });

    if(tl.osType().match(/^Win/)) {
         it('Runs successfully for windows docker compose service build', (done:Mocha.Done) => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Build services";
            tr.run();

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker-compose -f F:\\dir2\\docker-compose.yml build") != -1, "docker compose build should run");
            console.log(tr.stderr);
            done();
        });

        it('Runs successfully for windows docker compose service build, using user defined dcoker compose exe', (done:Mocha.Done) => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Build services";
            process.env["__dockerComposePath__"] = "docker-compose-userdefined";
            tr.run();

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker-compose-userdefined -f F:\\dir2\\docker-compose.yml build") != -1, "docker compose build should run");
            console.log(tr.stderr);
            done();
        });

        it('Runs successfully for windows docker compose push service', (done:Mocha.Done) => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Push services";
            tr.run();

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker push dir2_web") != -1, "docker compose push should run");
            console.log(tr.stderr);
            done();
        });

        it('Runs successfully for windows docker compose run service', (done:Mocha.Done) => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Run services";
            tr.run();

            assert(tr.invokedToolCount == 1, 'should have invoked tool three times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker-compose -f F:\\dir2\\docker-compose.yml up") != -1, "docker compose push should run");
            console.log(tr.stderr);
            done();
        });

        it('Runs successfully for windows docker compose push service with ACR', (done:Mocha.Done) => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Push services";
            process.env["__container_type__"] = "Azure Container Registry";
            process.env["__qualifyImageNames__"] = "true";
            tr.run();
            
            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker push ajgtestacr1.azurecr.io/dir2_web") != -1, "docker compose push should run");
            console.log(tr.stderr);
            done();
        });

        it('Runs successfully for windows docker compose up command with ACR and additional docker compose file', (done:Mocha.Done) => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Run a Docker Compose command";
            process.env["__container_type__"] = "Azure Container Registry";
            process.env["__additionalDockerComposeFiles__"] = "F:\\dir2\\docker-compose.override.yml";
            process.env["__dockerComposeCommand__"] = "up -d"
            
            tr.run();
            
            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker-compose -f F:\\dir2\\docker-compose.yml -f F:\\dir2\\docker-compose.override.yml up -d") != -1, "successfully ran up command");
            console.log(tr.stderr);
            done();
        });

        it('Runs successfully for windows docker compose up command with ACR and additional docker compose file not present warning', (done:Mocha.Done) => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Run a Docker Compose command";
            process.env["__container_type__"] = "Azure Container Registry";
            process.env["__additionalDockerComposeFiles__"] = "F:\\dir2\\docker-compose.override-notpresent.yml";
            process.env["__dockerComposeCommand__"] = "up -d"
            
            tr.run();
            
            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker-compose -f F:\\dir2\\docker-compose.yml up -d") != -1, "successfully ran up command");
            assert(tr.stdout.indexOf("vso[task.issue type=warning;]loc_mock_AdditionalDockerComposeFileDoesNotExists F:\\dir2\\docker-compose.override-notpresent.yml") != -1, "successfully identified missing override file.");
            console.log(tr.stderr);
            done();
        });

        it('Runs successfully for windows docker compose command with arguments', (done:Mocha.Done) => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Run a Docker Compose command";
            process.env["__container_type__"] = "Azure Container Registry"
            process.env["__dockerComposeCommand__"] = "pull"
            process.env["__arguments__"] = "service1 service2";
            
            tr.run();
            
            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker-compose -f F:\\dir2\\docker-compose.yml pull service1 service2") != -1, "docker compose <command> should run with arguments");
            console.log(tr.stderr);
            done();
        });

        it('Runs successfully for windows docker compose up command with ACR and additional docker compose relative file path', (done:Mocha.Done) => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Run a Docker Compose command";
            process.env["__container_type__"] = "Azure Container Registry";
            process.env["__additionalDockerComposeFiles__"] = "docker-compose.override.yml";
            process.env["__dockerComposeCommand__"] = "up -d"
            
            tr.run();
            
            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker-compose -f F:\\dir2\\docker-compose.yml -f F:\\dir2\\docker-compose.override.yml up -d") != -1, "successfully ran up command");
            console.log(tr.stderr);
            done();
        });

        it('Runs successfully for windows docker compose service build with arguments', (done:Mocha.Done) => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Build services";
            process.env["__arguments__"] = "--pull --parallel";
            tr.run();

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker-compose -f F:\\dir2\\docker-compose.yml build --pull --parallel") != -1, "docker compose build should run with argumentss");
            console.log(tr.stderr);
            done();
        });

    } else {

        it('Runs successfully for linux docker compose service build', (done:Mocha.Done) => {
            let tp = path.join(__dirname, 'L0Linux.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Build services";
            tr.run();

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker-compose -f /tmp/tempdir/100/docker-compose.yml build") != -1, "docker compose build should run");
            console.log(tr.stderr);
            done();
        });

        it('Runs successfully for linux docker compose service build, using user defined dcoker compose path', (done:Mocha.Done) => {
            let tp = path.join(__dirname, 'L0Linux.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Build services";
            process.env["__dockerComposePath__"] = "docker-compose-userdefined";
            tr.run();

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker-compose-userdefined -f /tmp/tempdir/100/docker-compose.yml build") != -1, "docker compose build should run");
            console.log(tr.stderr);
            done();
        });

        it('Runs successfully for linux docker compose push service', (done:Mocha.Done) => {
            let tp = path.join(__dirname, 'L0Linux.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Push services";
            tr.run();

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker push 100_web") != -1, "docker compose push should run");
            console.log(tr.stderr);
            done();
        });

        it('Runs successfully for linux docker compose run service', (done:Mocha.Done) => {
            let tp = path.join(__dirname, 'L0Linux.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Run services";
            tr.run();

            assert(tr.invokedToolCount == 1, 'should have invoked tool three times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker-compose -f /tmp/tempdir/100/docker-compose.yml up") != -1, "docker compose push should run");
            console.log(tr.stderr);
            done();
        });

        it('Runs successfully for linux docker compose push service with ACR', (done:Mocha.Done) => {
            let tp = path.join(__dirname, 'L0Linux.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Push services";
            process.env["__container_type__"] = "Azure Container Registry";
            process.env["__qualifyImageNames__"] = "true";
            tr.run();
            
            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker push ajgtestacr1.azurecr.io/100_web") != -1, "docker compose push should run");
            console.log(tr.stderr);
            done();
        });

        it('Runs successfully for linux docker compose up command with ACR and additonal compose file', (done:Mocha.Done) => {
            let tp = path.join(__dirname, 'L0Linux.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Run a Docker Compose command";
            process.env["__container_type__"] = "Azure Container Registry";
            process.env["__additionalDockerComposeFiles__"] = "/tmp/tempdir/100/docker-compose.override.yml";
            process.env["__dockerComposeCommand__"] = "up -d"

            tr.run();

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker-compose -f /tmp/tempdir/100/docker-compose.yml -f /tmp/tempdir/100/docker-compose.override.yml up -d") != -1, "successfully ran up command");
            console.log(tr.stderr);
            done();
        });

        it('Runs successfully for linux docker compose up command with ACR and additonal compose file not present warning', (done:Mocha.Done) => {
            let tp = path.join(__dirname, 'L0Linux.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Run a Docker Compose command";
            process.env["__container_type__"] = "Azure Container Registry";
            process.env["__additionalDockerComposeFiles__"] = "/tmp/tempdir/100/docker-compose.override-notpresent.yml";
            process.env["__dockerComposeCommand__"] = "up -d"

            tr.run();

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker-compose -f /tmp/tempdir/100/docker-compose.yml up -d") != -1, "successfully ran up command");
            assert(tr.stdout.indexOf("vso[task.issue type=warning;]loc_mock_AdditionalDockerComposeFileDoesNotExists /tmp/tempdir/100/docker-compose.override-notpresent.yml") != -1, "successfully identifed missing additional compose file.");
            console.log(tr.stderr);
            done();
        });

        it('Runs successfully for linux docker compose up command with ACR and additonal compose relative file path', (done:Mocha.Done) => {
            let tp = path.join(__dirname, 'L0Linux.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Run a Docker Compose command";
            process.env["__container_type__"] = "Azure Container Registry";
            process.env["__additionalDockerComposeFiles__"] = "docker-compose.override.yml";
            process.env["__dockerComposeCommand__"] = "up -d"

            tr.run();

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker-compose -f /tmp/tempdir/100/docker-compose.yml -f /tmp/tempdir/100/docker-compose.override.yml up -d") != -1, "successfully ran up command");
            console.log(tr.stderr);
            done();
        });

        it('Runs successfully for linux docker compose service build with arguments', (done:Mocha.Done) => {
            let tp = path.join(__dirname, 'L0Linux.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Build services";
            process.env["__arguments__"] = "--pull --parallel";
            tr.run();

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker-compose -f /tmp/tempdir/100/docker-compose.yml build --pull --parallel") != -1, "docker compose build should run with argumentss");
            console.log(tr.stderr);
            done();
        });

        it('Runs successfully for linux docker compose command with arguments', (done:Mocha.Done) => {
            let tp = path.join(__dirname, 'L0Linux.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Run a Docker Compose command";
            process.env["__container_type__"] = "Azure Container Registry"
            process.env["__dockerComposeCommand__"] = "pull"
            process.env["__arguments__"] = "service1 service2";
            
            tr.run();
            
            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker-compose -f /tmp/tempdir/100/docker-compose.yml pull service1 service2") != -1, "docker compose <command> should run with arguments");
            console.log(tr.stderr);
            done();
        });
    }
});