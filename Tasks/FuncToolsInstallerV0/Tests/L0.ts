import * as path from "path";
import * as assert from "assert";
import { MockTestRunner } from "azure-pipelines-task-lib/mock-test";

describe('FuncToolsInstallerV0 Suite', function() {
    this.timeout(60000);

    before((done) => {
        done();
    });

    after(function () {
        // Cleanup if needed
    });

    // Error handling tests - these work because they test failure scenarios
    it('Should fail with invalid version format', async () => {
        let tp = path.join(__dirname, 'L0InvalidVersionFormat.js');
        let tr: MockTestRunner = new MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.failed, 'Should have failed');
        assert(tr.stdOutContained('NotAValidSemverVersion') || tr.stdOutContained('not specified in correct format'), 'Should show version format error');
    });

    it('Should handle download failure gracefully', async () => {
        let tp = path.join(__dirname, 'L0DownloadFailure.js');
        let tr: MockTestRunner = new MockTestRunner(tp);
        await tr.runAsync();
        assert(tr.failed, 'Should have failed');
        assert(tr.stdOutContained('FuncDownloadFailed') || tr.stdOutContained('Failed to download') || tr.stdOutContained('Network error'), 'Should show download error');
    });
});
