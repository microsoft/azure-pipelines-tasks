import * as assert from 'assert';
import { TestHelpers } from './TestHelpers';
import { TestDataBuilder } from './TestConstants';

describe('NuGetV0 L0 Suite - Error Handling', function () {
    this.timeout(30000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('NuGet Execution Failures', function () {
        it('fails when NuGet returns a nonzero exit code', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forExecutionFailure()
            );

            TestHelpers.assertFailure(tr);
            // Verify the task result was set to failed (errorIssues populated)
            assert(tr.errorIssues.length > 0, 'Should have error issues from nonzero exit code');
        });
    });

    describe('Tool Resolution Failures', function () {
        it('fails when NuGet tool getter throws an error', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forGetNuGetFailure()
            );

            TestHelpers.assertFailure(tr, 'Failed to get NuGet tool');
        });
    });

    describe('Packaging Location Failures', function () {
        it('fails when packaging URIs cannot be retrieved', async () => {
            const tr = await TestHelpers.runTest(
                TestDataBuilder.forPackagingLocationFailure()
            );

            TestHelpers.assertFailure(tr, 'Unable to get packaging URIs');
        });
    });
});
