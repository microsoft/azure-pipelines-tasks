import assert = require('assert');
import fs = require('fs');
import os = require('os');
import path = require('path');
import { MockTestRunner } from 'azure-pipelines-task-lib/mock-test';
import { ArtifactEngineOptions } from 'artifact-engine/Engine/artifactEngineOptions';

export async function getDownloaderOptions(pattern: string, flag?: string, parallel = '6', debug = 'true'): Promise<ArtifactEngineOptions> {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'jenkins-task-'));
    const environment = {
        // ARM import requires this; task-lib's vault key must be private to each child.
        AGENT_TEMPDIRECTORY: temporaryDirectory,
        DISTRIBUTEDTASK_TASKS_JENKINSDOWNLOADARTIFACTSVSOCOMMANDBLOCKINGFIXENABLED: flag,
        JENKINS_TEST_PATTERN: pattern,
        JENKINS_TEST_PARALLEL: parallel,
        JENKINS_TEST_DEBUG: debug
    };
    const previous: { [name: string]: string } = {};
    Object.keys(environment).forEach(name => {
        previous[name] = process.env[name];
        if (environment[name] === undefined) {
            delete process.env[name];
        } else {
            process.env[name] = environment[name];
        }
    });
    try {
        const runner = new MockTestRunner(path.join(__dirname, 'CommandBlockingTask.js'));
        // Use the suite's runtime without downloading a second Node version.
        runner.nodePath = process.execPath;
        await runner.runAsync();
        assert.strictEqual(runner.failed, false, runner.stdout + runner.stderr);
        assert(runner.stdOutContained('ArtifactSuccessfullyDownloaded'), runner.stdout);
        const captures = runner.stdout.split(/\r?\n/).filter(line => line.indexOf('JENKINS_DOWNLOADER_OPTIONS=') === 0);
        assert.strictEqual(captures.length, 1, runner.stdout);
        const captured: { provider: string; options: ArtifactEngineOptions } =
            JSON.parse(captures[0].substring('JENKINS_DOWNLOADER_OPTIONS='.length));
        assert.strictEqual(captured.provider, pattern === '**' ? 'ZipProvider' : 'WebProvider');
        return Object.assign(new ArtifactEngineOptions(), captured.options);
    } finally {
        Object.keys(environment).forEach(name => {
            if (previous[name] === undefined) {
                delete process.env[name];
            } else {
                process.env[name] = previous[name];
            }
        });
        fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
}

describe('Jenkins downloader command modes', function () {
    this.timeout(30000);
    for (const pattern of ['drop/**/*.txt\n!drop/skip.txt', '**']) {
        for (const flag of [undefined, 'false', 'true']) {
            it(`passes ${flag || 'absent'} flag options to the ${pattern === '**' ? 'ZIP' : 'per-file'} engine`, async () => {
                const options = await getDownloaderOptions(pattern, flag);
                assert.strictEqual(options.vsoCommandMode, flag === 'true' ? 'blockAndTelemetry' : 'telemetryOnly');
                assert.strictEqual(options.itemPattern, pattern);
                assert.strictEqual(options.parallelProcessingLimit, 6);
                assert.strictEqual(options.verbose, true);
            });
        }
        it(`preserves default parallelism and disabled verbose output for ${pattern}`, async () => {
            const options = await getDownloaderOptions(pattern, 'true', '0', 'false');
            assert.strictEqual(options.parallelProcessingLimit, 4);
            assert.strictEqual(options.verbose, false);
        });
    }
});
