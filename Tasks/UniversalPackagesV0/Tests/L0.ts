import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('UniversalPackages Suite', function () {
    before(() => {
    });

    after(() => {
    });

    it('downloads package from current organization', function (done: Mocha.Done) {
        this.timeout(5000);
        let tp = path.join(__dirname, './downloadInternal.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run()
        assert(tr.invokedToolCount == 1, 'should have run ArtifactTool once');
        assert(tr.ran('c:\\mock\\location\\ArtifactTool.exe universal download --feed TestFeed --service https://example.visualstudio.com/defaultcollection --package-name TestPackage --package-version 1.0.0 --path c:\\temp --patvar UNIVERSAL_DOWNLOAD_PAT --verbosity verbose'), 'it should have run ArtifactTool');
        assert(tr.stdOutContained('ArtifactTool.exe output'), "should have ArtifactTool output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();
    });
});
