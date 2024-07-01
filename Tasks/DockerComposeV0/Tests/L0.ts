import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tl = require('azure-pipelines-task-lib');

describe('Docker Compose Suite', function() {
    this.timeout(30000);
    let composeCommand: string;

    before(() => {
        if (tl.which("docker")) {
            composeCommand = "docker compose";
        } else {
            composeCommand = "docker-compose";
        }

        console.log("composeCommand: " + composeCommand);
    })

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

    if (tl.getPlatform() === tl.Platform.Windows) {
        it('Runs successfully for windows docker compose service build', async () => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Build services";

            await tr.runAsync();
            console.log(tr.stdout);
            console.log(tr.stderr);

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]" + composeCommand + " -f F:\\dir2\\docker-compose.yml build") != -1, "docker compose build should run");
        });

        it('Runs successfully for windows docker compose service build, using user defined docker compose exe', async () => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Build services";
            process.env["__dockerComposePath__"] = "docker-compose-userdefined";

            await tr.runAsync();

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker-compose-userdefined -f F:\\dir2\\docker-compose.yml build") != -1, "docker compose build should run");
            
        });

        it('Runs successfully for windows docker compose push service', async () => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Push services";

            await tr.runAsync();

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker push dir2_web") != -1, "docker compose push should run");
            
        });

        it('Runs successfully for windows docker compose run service', async() => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Run services";

            await tr.runAsync();
            
            assert(tr.invokedToolCount == 1, 'should have invoked tool three times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]" + composeCommand + " -f F:\\dir2\\docker-compose.yml up") != -1, "docker compose push should run");
            
        });

        it('Runs successfully for windows docker compose push service with ACR', async () => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Push services";
            process.env["__container_type__"] = "Azure Container Registry";
            process.env["__qualifyImageNames__"] = "true";

            await tr.runAsync();

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker push ajgtestacr1.azurecr.io/dir2_web") != -1, "docker compose push should run");
            
        });

        it('Runs successfully for windows docker compose up command with ACR and additional docker compose file', async () => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Run a Docker Compose command";
            process.env["__container_type__"] = "Azure Container Registry";
            process.env["__additionalDockerComposeFiles__"] = "F:\\dir2\\docker-compose.override.yml";
            process.env["__dockerComposeCommand__"] = "up -d"

            await tr.runAsync();

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]" + composeCommand + " -f F:\\dir2\\docker-compose.yml -f F:\\dir2\\docker-compose.override.yml up -d") != -1, "successfully ran up command");
            
        });

        it('Runs successfully for windows docker compose up command with ACR and additional docker compose file not present warning', async () => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Run a Docker Compose command";
            process.env["__container_type__"] = "Azure Container Registry";
            process.env["__additionalDockerComposeFiles__"] = "F:\\dir2\\docker-compose.override-notpresent.yml";
            process.env["__dockerComposeCommand__"] = "up -d"

            await tr.runAsync();

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]" + composeCommand + " -f F:\\dir2\\docker-compose.yml up -d") != -1, "successfully ran up command");
            assert(tr.stdout.indexOf("vso[task.issue type=warning;source=TaskInternal;]loc_mock_AdditionalDockerComposeFileDoesNotExists F:\\dir2\\docker-compose.override-notpresent.yml") != -1, "successfully identified missing override file.");
            
        });

        it('Runs successfully for windows docker compose command with arguments', async () => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Run a Docker Compose command";
            process.env["__container_type__"] = "Azure Container Registry"
            process.env["__dockerComposeCommand__"] = "pull"
            process.env["__arguments__"] = "service1 service2";

            await tr.runAsync();

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]" + composeCommand + " -f F:\\dir2\\docker-compose.yml pull service1 service2") != -1, "docker compose <command> should run with arguments");
            
        });

        it('Runs successfully for windows docker compose up command with ACR and additional docker compose relative file path', async () => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Run a Docker Compose command";
            process.env["__container_type__"] = "Azure Container Registry";
            process.env["__additionalDockerComposeFiles__"] = "docker-compose.override.yml";
            process.env["__dockerComposeCommand__"] = "up -d"

            await tr.runAsync();

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]" + composeCommand + " -f F:\\dir2\\docker-compose.yml -f F:\\dir2\\docker-compose.override.yml up -d") != -1, "successfully ran up command");
            
        });

        it('Runs successfully for windows docker compose service build with arguments', async () => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Build services";
            process.env["__arguments__"] = "--pull --parallel";

            await tr.runAsync();

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]" + composeCommand + " -f F:\\dir2\\docker-compose.yml build --pull --parallel") != -1, "docker compose build should run with argumentss");
            
        });
    } else {
        it('Runs successfully for linux docker compose service build', async () => {
            let tp = path.join(__dirname, 'L0Linux.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Build services";

            await tr.runAsync();

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]" + composeCommand + " -f /tmp/tempdir/100/docker-compose.yml build") != -1, "docker compose build should run");
            
        });

        it('Runs successfully for linux docker compose service build, using user defined docker compose path', async () => {
            let tp = path.join(__dirname, 'L0Linux.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Build services";
            process.env["__dockerComposePath__"] = "docker-compose-userdefined";

            await tr.runAsync();

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker-compose-userdefined -f /tmp/tempdir/100/docker-compose.yml build") != -1, "docker compose build should run");
            
        });

        it('Runs successfully for linux docker compose push service', async () => {
            let tp = path.join(__dirname, 'L0Linux.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Push services";

            await tr.runAsync();

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker push 100_web") != -1, "docker compose push should run");
            
        });

        it('Runs successfully for linux docker compose run service', async () => {
            let tp = path.join(__dirname, 'L0Linux.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Run services";

            await tr.runAsync();

            assert(tr.invokedToolCount == 1, 'should have invoked tool three times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]" + composeCommand + " -f /tmp/tempdir/100/docker-compose.yml up") != -1, "docker compose push should run");
            
        });

        it('Runs successfully for linux docker compose push service with ACR', async () => {
            let tp = path.join(__dirname, 'L0Linux.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Push services";
            process.env["__container_type__"] = "Azure Container Registry";
            process.env["__qualifyImageNames__"] = "true";

            await tr.runAsync();

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker push ajgtestacr1.azurecr.io/100_web") != -1, "docker compose push should run");
            
        });

        it('Runs successfully for linux docker compose up command with ACR and additonal compose file', async () => {
            let tp = path.join(__dirname, 'L0Linux.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Run a Docker Compose command";
            process.env["__container_type__"] = "Azure Container Registry";
            process.env["__additionalDockerComposeFiles__"] = "/tmp/tempdir/100/docker-compose.override.yml";
            process.env["__dockerComposeCommand__"] = "up -d"

            await tr.runAsync();

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]" + composeCommand + " -f /tmp/tempdir/100/docker-compose.yml -f /tmp/tempdir/100/docker-compose.override.yml up -d") != -1, "successfully ran up command");
            
        });

        it('Runs successfully for linux docker compose up command with ACR and additonal compose file not present warning', async () => {
            let tp = path.join(__dirname, 'L0Linux.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Run a Docker Compose command";
            process.env["__container_type__"] = "Azure Container Registry";
            process.env["__additionalDockerComposeFiles__"] = "/tmp/tempdir/100/docker-compose.override-notpresent.yml";
            process.env["__dockerComposeCommand__"] = "up -d"

            await tr.runAsync();

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]" + composeCommand + " -f /tmp/tempdir/100/docker-compose.yml up -d") != -1, "successfully ran up command");
            assert(tr.stdout.indexOf("vso[task.issue type=warning;source=TaskInternal;]loc_mock_AdditionalDockerComposeFileDoesNotExists /tmp/tempdir/100/docker-compose.override-notpresent.yml") != -1, "successfully identifed missing additional compose file.");
            
        });

        it('Runs successfully for linux docker compose up command with ACR and additonal compose relative file path', async () => {
            let tp = path.join(__dirname, 'L0Linux.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Run a Docker Compose command";
            process.env["__container_type__"] = "Azure Container Registry";
            process.env["__additionalDockerComposeFiles__"] = "docker-compose.override.yml";
            process.env["__dockerComposeCommand__"] = "up -d"

            await tr.runAsync();

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]" + composeCommand + " -f /tmp/tempdir/100/docker-compose.yml -f /tmp/tempdir/100/docker-compose.override.yml up -d") != -1, "successfully ran up command");
            
        });

        it('Runs successfully for linux docker compose service build with arguments', async () => {
            let tp = path.join(__dirname, 'L0Linux.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Build services";
            process.env["__arguments__"] = "--pull --parallel";

            await tr.runAsync();

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]" + composeCommand + " -f /tmp/tempdir/100/docker-compose.yml build --pull --parallel") != -1, "docker compose build should run with argumentss");
            
        });

        it('Runs successfully for linux docker compose command with arguments', async () => {
            let tp = path.join(__dirname, 'L0Linux.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Run a Docker Compose command";
            process.env["__container_type__"] = "Azure Container Registry"
            process.env["__dockerComposeCommand__"] = "pull"
            process.env["__arguments__"] = "service1 service2";
            
            await tr.runAsync();

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]" + composeCommand + " -f /tmp/tempdir/100/docker-compose.yml pull service1 service2") != -1, "docker compose <command> should run with arguments");
            
        });
    }
});