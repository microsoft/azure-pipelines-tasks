import * as path from "path";
import * as assert from "assert";
import * as ttm from "azure-pipelines-task-lib/mock-test";
import tl = require('azure-pipelines-task-lib');

import './DeploymentFactoryTests';

const tmpDir = path.join(__dirname, 'temp');

describe('AzureFunctionAppV1 Suite', function () {
    this.timeout(180000);
    this.beforeAll(async function () {
        tl.mkdirP(tmpDir);
    });
    this.afterAll(async function () {
        tl.rmRF(tmpDir);
    });

    it('Validate TaskParameters mock run starts correctly', async () => {
        let tp = path.join(__dirname, 'TaskParametersTests.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        try {
            await tr.runAsync();
            // Verify that the task correctly resolves the service connection
            // and gets connection details before failing on the actual API call
            assert(tr.stdOutContained('loc_mock_GotconnectiondetailsforazureRMWebApp0'),
                   'Should have printed connection details message');
        }
        catch (error) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            throw error;
        }
    });
});
