import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('Publishing Symbol Suite', function () {
    before(() => {
    });

    after(() => {
    });

    it('(Publishing symbols) from current organization with NetCore version', function (done: MochaDone) {
        this.timeout(1000);
        let tp = path.join(__dirname, './PublishSymbolsInternal.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.invokedToolCount == 1, 'should have run client tool once');
        assert(tr.ran('c:\\mock\\location\\symbol.exe publish --name testpublishsymbol/testpublishsymbolbuild/2021.11.30/1/96acb404-71d9-4c3a-9214-13b42ab8229f --directory c:\\temp --expirationInDays 3650 --patvar SYMBOL_PAT_AUTH_TOKEN --verbosity verbose'), 'it should have run client tool sybmol.exe');
        assert(tr.stdOutContained('symbol.exe output'), "should have symbol output");
        assert(tr.succeeded, 'should have succeeded');
        assert.equal(tr.errorIssues.length, 0, "should have no errors");
        done();

    });
});