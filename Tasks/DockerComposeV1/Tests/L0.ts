import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tl = require('azure-pipelines-task-lib');

describe('Docker Compose Suite', function() {
    this.timeout(30000);
    let composeCommand: string;

    before(async() => {
        composeCommand = "docker compose";
    });

    beforeEach(() => {
        delete process.env["__command__"];
        delete process.env["__container_type__"];
        delete process.env["__qualifyImageNames__"];
        delete process.env["__additionalDockerComposeFiles__"];
        delete process.env["__composeFilePath__"];
        delete process.env["__nopIfNoDockerComposeFile__"];
        delete process.env["__useMissingFileMessageFallback__"];
        delete process.env["__omitComposeFile__"];
        delete process.env["__failMissingFileFormatter__"];
        delete process.env["__failMissingFileLog__"];
        delete process.env["__dockerComposeCommand__"];
        delete process.env["__arguments__"];
        delete process.env["__dockerComposePath__"];
    });

    [
        { name: 'undefined', value: undefined, fallback: false },
        { name: 'off', value: 'false', fallback: false },
        { name: 'on', value: 'true', fallback: true }
    ].forEach(flag => {
        [
            { name: 'ordinary text', value: 'missing-compose.yml', expected: 'missing-compose.yml' },
            { name: 'LF separators', value: 'missing-compose.yml\n##vso[example]value', expected: 'missing-compose.yml\n##_vso[example]value' },
            { name: 'CRLF separators', value: 'missing-compose.yml\r\n##vso[example]value', expected: 'missing-compose.yml\r\n##_vso[example]value' }
        ].forEach(testCase => {
            it(`Reports the optional missing file with ${testCase.name} and message fallback ${flag.name}`, async () => {
                const runner = tl.getPlatform() === tl.Platform.Windows ? 'L0Windows.js' : 'L0Linux.js';
                const tr = new ttm.MockTestRunner(path.join(__dirname, runner));
                tr.nodePath = process.execPath;
                process.env["__nopIfNoDockerComposeFile__"] = "true";
                process.env["__composeFilePath__"] = testCase.value;
                if (flag.value !== undefined) {
                    process.env["__useMissingFileMessageFallback__"] = flag.value;
                }
                if (flag.fallback) {
                    process.env["__failMissingFileFormatter__"] = "true";
                }

                await tr.runAsync();

                assert(tr.succeeded, 'the optional missing file should not fail the task');
                assert.strictEqual(tr.stderr, '', 'the optional missing file should not write an error');
                assert(tr.stdout.indexOf('##vso[task.complete result=Succeeded;]') !== -1,
                    'the task should report successful completion');
                assert.strictEqual(tr.invokedToolCount, 0, 'the optional missing file should not invoke a tool');
                const lines = tr.stdout.split(/\r?\n/);
                const diagnostics = lines.filter(line => line.startsWith('No Docker Compose file'));
                assert(lines.every(line => {
                    const marker = line.indexOf('##vso[example]');
                    return marker === -1 || line.indexOf('##vso[') < marker;
                }), 'the example marker should not be emitted as a separate command');
                const message = flag.fallback ? "No Docker Compose file was found; skipping."
                    : `No Docker Compose file matching ${testCase.expected} was found.`;
                assert.deepStrictEqual(diagnostics, [message.split(/\r?\n/)[0]],
                    'the diagnostic should appear exactly once in both modes');
                assert(tr.stdout.indexOf(message) !== -1,
                    'the diagnostic should use the processed path or a fixed fallback');
            });
        });

        it(`Requires the Compose file input with message fallback ${flag.name}`, async () => {
            const runner = tl.getPlatform() === tl.Platform.Windows ? 'L0Windows.js' : 'L0Linux.js';
            const tr = new ttm.MockTestRunner(path.join(__dirname, runner));
            tr.nodePath = process.execPath;
            process.env["__nopIfNoDockerComposeFile__"] = "true";
            process.env["__omitComposeFile__"] = "true";
            if (flag.value !== undefined) {
                process.env["__useMissingFileMessageFallback__"] = flag.value;
            }

            await tr.runAsync();

            assert(tr.errorIssues.some(issue => /Input required|LIB_InputRequired/.test(issue) && issue.indexOf('dockerComposeFile') !== -1),
                'an absent required input should retain its existing error');
            assert(tr.failed && tr.stdout.indexOf('##vso[task.complete result=Failed;]') !== -1,
                'an absent required input should report failed completion');
            assert(tr.stdout.indexOf('##vso[task.complete result=Succeeded;]') === -1,
                'an absent required input should not become a successful no-op');
            assert.strictEqual(tr.invokedToolCount, 0, 'an absent required input should not invoke a tool');
        });
    });

    ['formatter', 'log'].forEach(failure => {
        it(`Reports a general diagnostic when the file-name ${failure} fails`, async () => {
            const runner = tl.getPlatform() === tl.Platform.Windows ? 'L0Windows.js' : 'L0Linux.js';
            const tr = new ttm.MockTestRunner(path.join(__dirname, runner));
            tr.nodePath = process.execPath;
            process.env["__nopIfNoDockerComposeFile__"] = "true";
            process.env["__composeFilePath__"] = "missing-compose.yml\n##vso[example]value";
            process.env["__useMissingFileMessageFallback__"] = "false";
            process.env[failure === 'formatter' ? "__failMissingFileFormatter__" : "__failMissingFileLog__"] = "true";

            await tr.runAsync();

            assert(tr.succeeded);
            assert.strictEqual(tr.stderr, '');
            assert.deepStrictEqual(tr.errorIssues, []);
            assert(tr.stdout.indexOf('##vso[task.complete result=Succeeded;]') !== -1);
            assert.strictEqual(tr.invokedToolCount, 0);
            const diagnostics = tr.stdout.split(/\r?\n/).filter(line => line.startsWith('No Docker Compose file'));
            assert.deepStrictEqual(diagnostics, ['No Docker Compose file was found; unable to display the file name.']);
            assert(tr.stdout.indexOf('No Docker Compose file matching') === -1,
                'the failed diagnostic should not echo the supplied file name');
        });
    });

    if (tl.getPlatform() === tl.Platform.Windows) {
        it('Runs successfully for windows docker compose service build', async () => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Build services";

            await tr.runAsync();

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

        it('Runs successfully for windows docker compose service build and neutralizes ##vso[ commands in output', async () => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Build services";
            process.env["__composeFilePath__"] = "F:\\dir2\\vsoinjection-compose.yml";

            await tr.runAsync();

            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("Step 1/2 : FROM node:18\n##vso[task.setvariable") == -1,
                "##vso[ markers from attacker-controlled compose build output must be neutralized before reaching the log");
                        assert(tr.stdout.indexOf("Step 1/2 : FROM node:18\n##_vso[task.setvariable variable=NODE_OPTIONS]--require /tmp/evil.js\nsucessfully built the service images") != -1,
                            "sanitized marker (##_vso[) should still be present so the output stays readable");
        });

        it('Runs successfully for windows docker compose config and neutralizes ##vso[ commands on stderr', async () => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Build services";
            process.env["__composeFilePath__"] = "F:\\dir2\\vsoinjection-config-compose.yml";

            await tr.runAsync();

            assert(tr.succeeded, 'task should have succeeded');
            // getCombinedConfig() execs with silent:true, so the sanitized outStream is never
            // written to - compose stderr reaches the log only through the errline handler and
            // tl.error(). tl.error() emits the marker inside its own ##vso[task.issue] line and
            // escapes newlines, so this is defense in depth rather than an open hole, but the
            // sanitization must not regress.
                        assert(tr.errorIssues.some(issue => issue.indexOf("##_vso[task.setvariable variable=NODE_OPTIONS]--require /tmp/evil.js") != -1),
                "compose config stderr should still be reported as an error issue");
            assert(tr.errorIssues.every(issue => issue.indexOf("##vso[") == -1),
                "no error issue should carry an unneutralized ##vso[ marker");
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

            console.log(tr.stdout);
            console.log(tr.stderr);

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

        it('Runs successfully for linux docker compose service build and neutralizes ##vso[ commands in output', async () => {
            let tp = path.join(__dirname, 'L0Linux.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Build services";
            process.env["__composeFilePath__"] = "/tmp/tempdir/100/vsoinjection-compose.yml";

            await tr.runAsync();

            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("Step 1/2 : FROM node:18\n##vso[task.setvariable") == -1,
                "##vso[ markers from attacker-controlled compose build output must be neutralized before reaching the log");
                        assert(tr.stdout.indexOf("Step 1/2 : FROM node:18\n##_vso[task.setvariable variable=NODE_OPTIONS]--require /tmp/evil.js\nsucessfully built the service images") != -1,
                            "sanitized marker (##_vso[) should still be present so the output stays readable");
        });

        it('Runs successfully for linux docker compose config and neutralizes ##vso[ commands on stderr', async () => {
            let tp = path.join(__dirname, 'L0Linux.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Build services";
            process.env["__composeFilePath__"] = "/tmp/tempdir/100/vsoinjection-config-compose.yml";

            await tr.runAsync();

            assert(tr.succeeded, 'task should have succeeded');
            // getCombinedConfig() execs with silent:true, so the sanitized outStream is never
            // written to - compose stderr reaches the log only through the errline handler and
            // tl.error(). tl.error() emits the marker inside its own ##vso[task.issue] line and
            // escapes newlines, so this is defense in depth rather than an open hole, but the
            // sanitization must not regress.
                        assert(tr.errorIssues.some(issue => issue.indexOf("##_vso[task.setvariable variable=NODE_OPTIONS]--require /tmp/evil.js") != -1),
                "compose config stderr should still be reported as an error issue");
            assert(tr.errorIssues.every(issue => issue.indexOf("##vso[") == -1),
                "no error issue should carry an unneutralized ##vso[ marker");
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
