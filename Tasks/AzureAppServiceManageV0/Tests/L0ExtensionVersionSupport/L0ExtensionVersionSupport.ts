import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('AzureAppServiceManageV0 Extension Version Support Suite', function() {
    this.timeout(60000);

    it('Test extension version parsing with brackets format', async function() {
        let tp = path.join(__dirname, 'L0ExtensionVersionSupportTest.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.indexOf('Parsing extension: TestExtension(1.2.3)') !== -1, "Should parse extension with version in brackets");
        assert(tr.stdout.indexOf('Extension ID: TestExtension, Version: 1.2.3') !== -1, "Should extract correct ID and version");
        assert(tr.stdout.indexOf('Parsing extension: TestLatestExtension(latest)') !== -1, "Should parse extension with latest version");
        assert(tr.stdout.indexOf('Extension ID: TestLatestExtension, Version: latest') !== -1, "Should extract correct ID and latest version");
        assert(tr.stdout.indexOf('Force update for TestLatestExtension: true') !== -1, "Should set force update for latest version");
        assert(tr.stdout.indexOf('Parsing extension: TestNoVersion') !== -1, "Should handle extension without version");
        assert(tr.stdout.indexOf('Extension ID: TestNoVersion, Version: ') !== -1, "Should extract ID with empty version");
    });
});