import * as path from "path";
import * as assert from "assert";
import * as ttm from "azure-pipelines-task-lib/mock-test";
import tl = require('azure-pipelines-task-lib');

const tmpDir = path.join(__dirname, 'temp');

describe('AzureWebApp Suite', function() {
    this.timeout(60000);
    this.beforeAll(async function() {
        tl.mkdirP(tmpDir);
    });
    this.afterAll(async function() {
        tl.rmRF(tmpDir);
    });

    it('AzureWebAppV1 Validate TaskParameters', async () => {
        let tp = path.join(__dirname,'TaskParametersTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        try {
            await tr.runAsync();
            assert(tr.stdOutContained('msbuild package PRESENT'), 'Should have printed: msbuild package PRESENT');
        }
        catch(error) {
            console.log(tr.stdout);
            console.log(tr.stderr);
        }
    });
});