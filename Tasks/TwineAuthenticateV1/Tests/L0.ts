import * as path from 'path';
import * as assert from 'assert';
import * as ini from 'ini';
import * as fs from 'fs';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as tl from "azure-pipelines-task-lib/task";

const tempDir = path.join(__dirname, "temp");

describe('Twine Authenticate V1 Suite', function () {
    before(() => {
        tl.mkdirP(tempDir);
    });

    after(() => {
        tl.rmRF(tempDir);
    });

    it('sets authentication for current organization feed', function (done: Mocha.Done) {
        this.timeout(5000);
        let tp = path.join(__dirname, './setAuthInternalFeed.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.invokedToolCount == 0, 'no tool should be invoked.');
        assert(tr.succeeded, 'should have succeeded');
        assert.strictEqual(tr.errorIssues.length, 0, "should have no errors");
        let fileContent = ini.parse(fs.readFileSync(tempDir + path.sep + ".pypirc", "utf-8"));

        assert.strictEqual(fileContent["distutils"]["index-servers"], "TestFeed", "Test Feed should be added to auth list.");

        assert.strictEqual(fileContent["TestFeed"]["repository"],
        "https://vsts/packagesource/TestFeed",
        "Test Feed repository should be correct.");

        assert.strictEqual(fileContent["TestFeed"]["username"],
        "build",
        "Default username should be correct.");

        assert.strictEqual(fileContent["TestFeed"]["password"],
        "token",
        "Default password from environment variable should be correct.");

        done();
    });
});