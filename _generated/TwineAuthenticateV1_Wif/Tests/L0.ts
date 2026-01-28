import * as path from 'path';
import * as assert from 'assert';
import * as fs from 'fs';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as tl from "azure-pipelines-task-lib/task";

const tempDir = path.join(__dirname, "temp");

describe('Twine Authenticate V1 Suite', async () => {
    before(() => {
        tl.mkdirP(tempDir);
    });

    after(() => {
        tl.rmRF(tempDir);
    });

    it('sets authentication for current organization feed', async () => {
        let tp = path.join(__dirname, './setAuthInternalFeed.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();
        assert(tr.invokedToolCount == 0, 'no tool should be invoked.');
        assert(tr.succeeded, 'should have succeeded');
        assert.strictEqual(tr.errorIssues.length, 0, "should have no errors");

        let fileContent = fs.readFileSync(tempDir + path.sep + ".pypirc", "utf-8");

        let lines = fileContent.split(/\r?\n/);

        assert.strictEqual(lines[0], "[distutils]");
        assert.strictEqual(lines[1], "index-servers=TestFeed",
            "Test Feed should be added to auth list.");
        assert.strictEqual(lines[3], "[TestFeed]");
        assert.strictEqual(lines[4], "repository=https://vsts/packagesource/TestFeed",
            "Test Feed repository should be correct.");
        assert.strictEqual(lines[5], "username=build",
            "Default username should be correct.");
        assert.strictEqual(lines[6], "password=token",
            "Default password from environment variable should be correct.");
    }).timeout(50000);

    it('sets authentication for current organization feed with dot',  async () => {
        let tp = path.join(__dirname, './setAuthInternalFeedWithDot.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();
        assert(tr.invokedToolCount == 0, 'no tool should be invoked.');
        assert(tr.succeeded, 'should have succeeded');
        assert.strictEqual(tr.errorIssues.length, 0, "should have no errors");
        let fileContent = fs.readFileSync(tempDir + path.sep + ".pypirc", "utf-8");
        console.log('File content: ');
        console.log(fileContent);

        let lines = fileContent.split(/\r?\n/);

        assert.strictEqual(lines[0], "[distutils]");
        assert((lines[1] === "index-servers=Test.Feed")
            || (lines[1].startsWith('index-servers=') && lines[1].endsWith('Test.Feed')),
            "Test Feed should be added to auth list.");
        assert.strictEqual(lines[lines.length - 4], "[Test.Feed]");
        assert.strictEqual(lines[lines.length - 3], "repository=https://vsts/packagesource/Test.Feed",
            "Test Feed repository should be correct.");
        assert.strictEqual(lines[lines.length - 2], "username=build",
            "Default username should be correct.");
        assert.strictEqual(lines[lines.length - 1], "password=token",
            "Default password from environment variable should be correct.");
    }).timeout(50000);
});