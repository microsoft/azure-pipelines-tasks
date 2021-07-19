import * as assert from 'assert';
import * as path from 'path';

import { MockTestRunner } from 'azure-pipelines-task-lib/mock-test';

import { cleanTemporaryFolders, createTemporaryFolders, getTempDir } from './TestUtils';

describe('MavenV2 Suite', function () {
    before(() => {
        // Set up mock authorization
        process.env.ENDPOINT_AUTH_SYSTEMVSSCONNECTION = '{"parameters":{"AccessToken":"token"},"scheme":"OAuth"}';
        process.env.ENDPOINT_URL_SYSTEMVSSCONNECTION = 'https://example.visualstudio.com/defaultcollection';

        // Mock temp paths
        // process.env["MOCK_IGNORE_TEMP_PATH"] = "true"; // This will remove the temp path from any outputs
        process.env.MOCK_TEMP_PATH = path.join(__dirname, '..', '..');
        process.env.MOCK_NORMALIZE_SLASHES = 'true';

        createTemporaryFolders();
    });

    after(() => {
        cleanTemporaryFolders();
    });

    it('run maven with code coverage enabled and restore original pom.xml after', function (done: Mocha.Done) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
        const testPath = path.join(__dirname, 'L0RestoreOriginalPomXml.js');
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        assert(testRunner.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
        assert(testRunner.ran('/home/bin/maven/bin/mvn -f pom.xml help:effective-pom'), 'it should have generated effective pom');
        assert(testRunner.ran('/home/bin/maven/bin/mvn -f pom.xml clean package'), 'it should have run mvn -f pom.xml package');

        const readOriginalPomXmlLogIndex = testRunner.stdout.indexOf('Reading original pom.xml');
        assert(readOriginalPomXmlLogIndex !== -1, 'should have read original pom.xml');
        const wroteModifiedPomXmlLogIndex = testRunner.stdout.indexOf('Writing modified pom.xml contents');
        assert(wroteModifiedPomXmlLogIndex !== -1, 'should have written modified pom.xml contents');
        const wroteOriginalPomXmlLogIndex = testRunner.stdout.indexOf('Writing original pom.xml contents');
        assert(wroteOriginalPomXmlLogIndex !== -1, 'should have written original pom.xml contents');

        assert(readOriginalPomXmlLogIndex < wroteModifiedPomXmlLogIndex, 'it shouldn\'t have saved pom.xml before writing modified pom.xml contents');
        assert(wroteModifiedPomXmlLogIndex < wroteOriginalPomXmlLogIndex, 'it shouldn\'t have restored original pom.xml before writing modified pom.xml contents');

        assert(testRunner.invokedToolCount === 4, 'should have run maven exactly 3 times: ' + testRunner.invokedToolCount);
        assert(testRunner.stderr.length === 0, 'should not have written to stderr=' + testRunner.stderr);
        assert(testRunner.succeeded, 'task should have succeeded');

        done();
    });
});
