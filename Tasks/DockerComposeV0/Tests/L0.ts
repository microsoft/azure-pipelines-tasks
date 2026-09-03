import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tl = require('azure-pipelines-task-lib');
import { Writable } from 'stream';
import { sanitizeVsoCommands, createSanitizedOutputStream } from '../dockeroutputsanitizer';

describe('Docker Output Sanitizer Suite', function() {
    this.timeout(10000);

    // Collects everything written to a fake destination stream so tests can
    // assert on the final sanitized output.
    function captureDestination(): { stream: Writable, output: () => string } {
        let chunks: string[] = [];
        const stream = new Writable({
            write(chunk: any, _encoding: string, callback: (error?: Error | null) => void) {
                chunks.push(chunk.toString());
                callback();
            }
        });
        return { stream, output: () => chunks.join('') };
    }

    function writeAndEnd(stream: Writable, parts: (string | Buffer)[]): Promise<void> {
        return new Promise((resolve, reject) => {
            for (const part of parts) {
                stream.write(part);
            }
            stream.end(() => resolve());
        });
    }

    it('sanitizeVsoCommands leaves ordinary output untouched', () => {
        const input = 'Step 1/5 : FROM node:18\nSuccessfully built abc123';
        assert.strictEqual(sanitizeVsoCommands(input), input);
    });

    it('sanitizeVsoCommands neutralizes a ##vso[ command', () => {
        const input = '##vso[task.setvariable variable=NODE_OPTIONS]--require /tmp/evil.js';
        const output = sanitizeVsoCommands(input);
        assert.strictEqual(output.indexOf('##vso['), -1, 'marker should no longer be double-hash');
        assert.strictEqual(output, '#vso[task.setvariable variable=NODE_OPTIONS]--require /tmp/evil.js');
    });

    it('sanitizeVsoCommands collapses a run of many "#" before vso[ down to one', () => {
        const input = '####vso[task.setvariable variable=x]y';
        assert.strictEqual(sanitizeVsoCommands(input), '#vso[task.setvariable variable=x]y');
    });

    it('sanitizeVsoCommands is case-insensitive', () => {
        const input = '##VSO[TASK.SETVARIABLE variable=x]y';
        const output = sanitizeVsoCommands(input);
        assert.strictEqual(/##vso\[/i.test(output), false);
    });

    it('sanitizeVsoCommands neutralizes multiple markers in one string', () => {
        const input = '##vso[task.setvariable variable=a]1 and ##vso[task.setvariable variable=b]2';
        const output = sanitizeVsoCommands(input);
        assert.strictEqual((output.match(/##vso\[/gi) || []).length, 0);
        assert.strictEqual((output.match(/#vso\[/gi) || []).length, 2);
    });

    it('sanitizeVsoCommands does not touch a lone "#" or unrelated text starting with vso', () => {
        const input = '# just a comment, vso is not a command here';
        assert.strictEqual(sanitizeVsoCommands(input), input);
    });

    it('createSanitizedOutputStream neutralizes a marker split across chunk boundaries', async () => {
        const { stream: destination, output } = captureDestination();
        const sanitized = createSanitizedOutputStream(destination);

        // Split right in the middle of the marker, as a process could deliver it
        // across two separate pipe reads.
        await writeAndEnd(sanitized, ['prefix ##v', 'so[task.setvariable variable=NODE_OPTIONS]evil', ' suffix']);

        assert.strictEqual(output().indexOf('##vso['), -1, 'marker split across chunks must still be neutralized');
        assert.strictEqual(output(), 'prefix #vso[task.setvariable variable=NODE_OPTIONS]evil suffix');
    });

    it('createSanitizedOutputStream neutralizes a marker split one character at a time', async () => {
        const { stream: destination, output } = captureDestination();
        const sanitized = createSanitizedOutputStream(destination);

        const marker = '##vso[task.setvariable variable=x]y';
        await writeAndEnd(sanitized, marker.split(''));

        assert.strictEqual(output().indexOf('##vso['), -1);
        assert.strictEqual(output(), '#vso[task.setvariable variable=x]y');
    });

    it('createSanitizedOutputStream decodes a multi-byte UTF-8 character split across chunks', async () => {
        const { stream: destination, output } = captureDestination();
        const sanitized = createSanitizedOutputStream(destination);

        // '€' (U+20AC) encodes to the 3 bytes 0xE2 0x82 0xAC in UTF-8; split it
        // across two Buffer chunks to exercise the StringDecoder buffering.
        const encoded = Buffer.from('price: € ##vso[task.setvariable variable=x]y', 'utf8');
        const splitAt = encoded.indexOf(0x82); // inside the multi-byte sequence
        await writeAndEnd(sanitized, [encoded.subarray(0, splitAt), encoded.subarray(splitAt)]);

        assert.strictEqual(output(), 'price: € #vso[task.setvariable variable=x]y');
    });

    it('createSanitizedOutputStream passes through output with no markers unchanged', async () => {
        const { stream: destination, output } = captureDestination();
        const sanitized = createSanitizedOutputStream(destination);

        await writeAndEnd(sanitized, ['Step 1/5 : FROM node:18\n', 'Successfully built abc123\n']);

        assert.strictEqual(output(), 'Step 1/5 : FROM node:18\nSuccessfully built abc123\n');
    });
});

describe('Docker Compose Suite', function() {
    this.timeout(30000);
    let composeCommand: string;

    before(() => {
        composeCommand = "docker-compose";
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