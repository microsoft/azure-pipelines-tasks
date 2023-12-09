import * as path from "path";
import * as assert from "assert";
import * as ttm from "azure-pipelines-task-lib/mock-test";
import tl = require('azure-pipelines-task-lib');

const tmpDir = path.join(__dirname, 'temp');

describe('AzureWebApp Suite', function() {
    this.timeout(60000);
    this.beforeAll(done => {
        tl.mkdirP(tmpDir);
        done();
    });
    this.afterAll(done => {
        tl.rmRF(tmpDir);
        done();
    });

    before((done) => {
        if(!tl.exist(path.join(__dirname, '..', 'node_modules/azure-pipelines-tasks-azure-arm-rest/Tests/node_modules'))) {
            tl.cp(path.join( __dirname, 'node_modules'), path.join(__dirname, '..', 'node_modules/azure-pipelines-tasks-azure-arm-rest/Tests'), '-rf', true);
        }

       done();
    });

    it('AzureWebAppV1 Validate TaskParameters', (done: MochaDone) => {
        let tp = path.join(__dirname,'TaskParametersTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        try {
            tr.run();
            assert(tr.stdOutContained('msbuild package PRESENT'), 'Should have printed: msbuild package PRESENT');
            done();
        }
        catch(error) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            done(error);
        }
    });
});