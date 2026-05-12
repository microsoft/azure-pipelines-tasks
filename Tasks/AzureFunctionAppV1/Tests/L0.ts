import * as assert from "assert";
import * as ttm from "azure-pipelines-task-lib/mock-test";

import './DeploymentFactoryTests';

describe('AzureFunctionAppV1 Suite', function () {
    this.timeout(180000);

    it('Validate TaskParameters mock run starts correctly', async () => {
        let tp = require('path').join(__dirname, 'TaskParametersTests.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert.strictEqual(tr.succeeded, false, 'Task should not succeed in mock API path');
        assert.strictEqual(tr.failed, true, 'Task should fail in mock API path');
        assert(tr.errorIssues.some((e: string) => e.indexOf('loc_mock_FailedToGetResourceID') >= 0),
            `Expected resource-id failure. Errors: ${tr.errorIssues}`);
        assert(tr.stdOutContained('loc_mock_GotconnectiondetailsforazureRMWebApp0'),
               'Should print connection details message');
    });
});
