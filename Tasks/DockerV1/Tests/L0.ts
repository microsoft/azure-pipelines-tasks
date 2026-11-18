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

    function setupTagTestEnv(ffEnabled: boolean) {
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.tagImages;
        process.env[shared.TestEnvVars.containerType] = shared.ContainerTypes.AzureContainerRegistry;
        process.env[shared.TestEnvVars.qualifyImageName] = "true";
        process.env[shared.TestEnvVars.qualifySourceImageName] = "true";
        process.env[shared.TestEnvVars.useDockerSkipRedundantTagFeatureFlag] = ffEnabled ? "true" : "false";
    }

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
        delete process.env[shared.TestEnvVars.useDockerSkipRedundantTagFeatureFlag];
        delete process.env[shared.TestEnvVars.sanitizeDockerTagLogOutputFeatureFlag];
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
        setupTagTestEnv(true);
        await tr.runAsync();

        assert(tr.invokedToolCount == 0, 'should not have invoked tool since source and target are identical. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`Skipping tag`) != -1, "should log skip message when source and target are identical");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker tag image with sourcequalify set to true when feature flag is disabled', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        setupTagTestEnv(false);
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time when feature flag is disabled. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`[command]docker tag ajgtestacr1.azurecr.io/test/test:2 ajgtestacr1.azurecr.io/test/test:2`) != -1, "docker tag should run for identical source/target when feature flag is disabled");
        console.log(tr.stderr);
    });

    it('Runs successfully for docker tag image with mixed mappings when feature flag is enabled', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        setupTagTestEnv(true);
        process.env[shared.TestEnvVars.arguments] = "test/test:v1";
        await tr.runAsync();

        assert(tr.invokedToolCount == 1, 'should have invoked tool one time after skipping the redundant self-tag. actual: ' + tr.invokedToolCount);
        assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf(`Skipping tag`) != -1, "should log skip message for the redundant self-tag");
        assert(tr.stdout.indexOf(`[command]docker tag ajgtestacr1.azurecr.io/test/test:2 ajgtestacr1.azurecr.io/test/test:v1`) != -1, "docker tag should still run for later non-identical mappings");
        console.log(tr.stderr);
    });

    // Everything the redundant-tag skip log writes, from the "Skipping tag" line to the end of stdout. An image
    // name containing newlines spans several physical lines, so a single line is not enough to capture the whole
    // console.log call, and task-lib's own debug echo of the raw input comes earlier and is excluded by anchoring
    // on "Skipping tag".
    function getSkipBlock(stdout: string): { start: number, block: string } {
        const lines = stdout.split(/\r?\n/);
        const start = lines.findIndex(l => l.indexOf('Skipping tag') != -1);
        return { start, block: start >= 0 ? lines.slice(start).join('\n') : '' };
    }

    it('Sanitizes injected vso command in redundant-tag skip log when sanitize feature flag is enabled', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        setupTagTestEnv(true);
        process.env[shared.TestEnvVars.sanitizeDockerTagLogOutputFeatureFlag] = "true";
        process.env[shared.TestEnvVars.imageName] = "tag-proof\n##vso[task.prependpath]/tmp/evil";
        await tr.runAsync();

        assert(tr.succeeded, 'task should have succeeded');
        const skip = getSkipBlock(tr.stdout);
        assert(skip.start >= 0, 'redundant-tag skip branch must be present in the log');
        assert(tr.invokedToolCount == 0, 'docker tag should not have been invoked');
        // The agent recognizes a ##vso[ command anywhere in a line, not just at the start (verified against
        // azure-pipelines-agent's Command.TryParse, which accepts e.g. ">>>   ##vso[area.event ...]"). So the
        // marker must not survive anywhere in the skip block, not just at line start. We check only the skip
        // block (not all of stdout) because task-lib's own debug echo of the raw input is unrelated/harmless.
        assert(!/##vso\[task\.prependpath\]/.test(skip.block), 'injected command must not survive anywhere in the skip block');
        assert(/#vso\[task\.prependpath\]\/tmp\/evil/.test(skip.block), 'sanitized text should still be visible in the skip block');
    });

    [
        ['uppercase marker', 'tag-proof\n##VSO[task.prependpath]/tmp/evil'],
        ['carriage-return separator', 'tag-proof\r##vso[task.prependpath]/tmp/evil'],
        ['extra leading hashes', 'tag-proof\n####vso[task.prependpath]/tmp/evil'],
        ['multiple commands', 'tag-proof\n##vso[task.prependpath]/tmp/evil\n##vso[task.setvariable variable=injected]yes'],
        // The agent recognizes ##vso[ anywhere in a line, not just at the start (see Command.TryParse in
        // azure-pipelines-agent), so a marker that never starts a line must be caught too.
        ['inline marker not at line start', 'tag-proof prefix ##vso[task.prependpath]/tmp/evil']
    ].forEach(([name, injectedImageName]) => {
        it(`Neutralizes injected vso command variant (${name}) when sanitize feature flag is enabled`, async () => {
            let tp = path.join(__dirname, 'TestSetup.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            setupTagTestEnv(true);
            process.env[shared.TestEnvVars.sanitizeDockerTagLogOutputFeatureFlag] = "true";
            process.env[shared.TestEnvVars.imageName] = injectedImageName;
            await tr.runAsync();

            assert(tr.succeeded, 'task should have succeeded');
            const skip = getSkipBlock(tr.stdout);
            assert(skip.start >= 0, 'redundant-tag skip branch must be present in the log');
            assert(skip.block.indexOf('tag-proof') != -1, 'skip block should contain the logged image name');
            assert(!/#{2,}vso\[task\.prependpath\]/i.test(skip.block), 'injected prependpath must not survive anywhere in the skip block');
            assert(!/#{2,}vso\[task\.setvariable variable=injected/i.test(skip.block), 'injected setvariable must not survive anywhere in the skip block');
        });
    });

    it('Preserves legacy skip log when sanitize feature flag is disabled', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        setupTagTestEnv(true);
        process.env[shared.TestEnvVars.sanitizeDockerTagLogOutputFeatureFlag] = "false";
        process.env[shared.TestEnvVars.imageName] = "tag-proof\n##vso[task.prependpath]/tmp/evil";
        await tr.runAsync();

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('Skipping tag') != -1, 'redundant-tag skip branch must have executed');
        assert(/^##vso\[task\.prependpath\]\/tmp\/evil/m.test(tr.stdout), 'legacy behavior is preserved when the sanitize feature flag is off');
    });

    it('Runs successfully for docker tag command with arguments', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.tagImages;
        process.env[shared.TestEnvVars.imageName] = 'test/test:latest';
        process.env[shared.TestEnvVars.arguments] = 'test/test:v1';
        await tr.runAsync();

        assert(tr.invokedToolCount == 2, 'should have invoked tool two times. actual: ' + tr.invokedToolCount);
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

    it('Runs successfully for docker build and neutralizes ##vso[ commands in output', async () => {
        let tp = path.join(__dirname, 'TestSetup.js');
        process.env[shared.TestEnvVars.imageName] = "testuser/vsoinjection:1";
        process.env[shared.TestEnvVars.command] = shared.CommandTypes.buildImage;
        process.env[shared.TestEnvVars.addBaseImageData] = "false";
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.succeeded, 'task should have succeeded');
        // Verifies createSanitizedExecOptions() is really wired into the live docker build
        // exec call: the console-visible build output (as the agent's log parser would see
        // it) must have the ##vso[ marker rewritten to ##_vso[.
        assert(tr.stdout.indexOf("Step 1/2 : FROM node:18\n##vso[task.setvariable") == -1,
            "##vso[ markers from attacker-controlled build output must be neutralized before reaching the log");
        assert(tr.stdout.indexOf("Step 1/2 : FROM node:18\n##_vso[task.setvariable variable=NODE_OPTIONS]--require /tmp/evil.js\nSuccessfully built abc123") != -1,
            "sanitized marker (##_vso[) should still be present so the output stays readable");
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
