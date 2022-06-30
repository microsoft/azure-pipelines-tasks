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
        assert("should have no errors", tp);
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.ran(`mock/location/symbol.exe publish --service https://example.artifacts.visualstudio.com --name testpublishsymbol/testpublishsymbolbuild/2021.11.30/1/8fd4c05c-e13b-4dc1-8f0f-7e1c661db3b5 --directory c:\\temp --expirationInDays 36530 --patAuthEnvVar SYMBOL_PAT_AUTH_TOKEN --fileListFileName ${path.join("c:\\agent\\_temp", "ListOfSymbols-8fd4c05c-e13b-4dc1-8f0f-7e1c661db3b5.txt")} --tracelevel verbose --globalretrycount 2`), 'it should have run client tool symbol.exe');
        assert(tr.stdOutContained('Symbol.exe output'), "should have symbol output");
        assert(tr.succeeded, 'should have succeeded');
        assert.strictEqual(tr.errorIssues.length, 0, "should have no errors");
        assert(tr.invokedToolCount > 0, 'should have run client tool once');
        done();
    });
});