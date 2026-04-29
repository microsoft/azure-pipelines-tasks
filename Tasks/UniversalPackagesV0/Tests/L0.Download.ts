import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('UniversalPackages L0 Suite - Internal Download', function () {
    this.timeout(10000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('Basic Download', function () {
        it('downloads package from current organization', async () => {
            const tr = await TestHelpers.runTest({
                [testConstants.TestEnvVars.artifactToolPath]: testConstants.TestData.defaultArtifactToolPath,
                [testConstants.TestEnvVars.command]: 'download',
                [testConstants.TestEnvVars.downloadDirectory]: testConstants.TestData.defaultDownloadDir,
                [testConstants.TestEnvVars.feedListDownload]: testConstants.TestData.defaultFeed,
                [testConstants.TestEnvVars.packageListDownload]: testConstants.TestData.defaultPackage,
                [testConstants.TestEnvVars.versionListDownload]: testConstants.TestData.defaultVersion,
                [testConstants.TestEnvVars.mockExitCode]: '0',
                [testConstants.TestEnvVars.mockStdout]: 'ArtifactTool.exe output',
            });

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertToolInvocationCount(tr, 1);
            TestHelpers.assertRanCommand(tr, TestHelpers.buildDownloadCommand({
                feed: testConstants.TestData.defaultFeed,
                packageName: testConstants.TestData.defaultPackage,
                packageVersion: testConstants.TestData.defaultVersion,
                downloadPath: testConstants.TestData.defaultDownloadDir,
            }));
            TestHelpers.assertStdoutContains(tr, 'ArtifactTool.exe output');
        });

        it('downloads to custom download directory', async () => {
            const customPath = 'd:\\custom\\download\\path';
            const tr = await TestHelpers.runTest({
                [testConstants.TestEnvVars.artifactToolPath]: testConstants.TestData.defaultArtifactToolPath,
                [testConstants.TestEnvVars.command]: 'download',
                [testConstants.TestEnvVars.downloadDirectory]: customPath,
                [testConstants.TestEnvVars.feedListDownload]: 'MyFeed',
                [testConstants.TestEnvVars.packageListDownload]: 'MyPackage',
                [testConstants.TestEnvVars.versionListDownload]: '2.5.0',
                [testConstants.TestEnvVars.mockExitCode]: '0',
                [testConstants.TestEnvVars.mockStdout]: 'ArtifactTool.exe output',
            });

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertToolInvocationCount(tr, 1);
            TestHelpers.assertRanCommand(tr, TestHelpers.buildDownloadCommand({
                feed: 'MyFeed',
                packageName: 'MyPackage',
                packageVersion: '2.5.0',
                downloadPath: customPath,
            }));
        });

        it('downloads from project-scoped feed', async () => {
            const tr = await TestHelpers.runTest({
                [testConstants.TestEnvVars.artifactToolPath]: testConstants.TestData.defaultArtifactToolPath,
                [testConstants.TestEnvVars.command]: 'download',
                [testConstants.TestEnvVars.downloadDirectory]: 'c:\\output',
                [testConstants.TestEnvVars.feedListDownload]: 'MyProject/MyFeed',
                [testConstants.TestEnvVars.packageListDownload]: 'MyPackage',
                [testConstants.TestEnvVars.versionListDownload]: '3.0.0',
                [testConstants.TestEnvVars.mockExitCode]: '0',
                [testConstants.TestEnvVars.mockStdout]: 'ArtifactTool.exe output',
            });

            TestHelpers.assertSuccess(tr);
            TestHelpers.assertToolInvocationCount(tr, 1);
            TestHelpers.assertRanCommand(tr, TestHelpers.buildDownloadCommand({
                feed: 'MyFeed',
                packageName: 'MyPackage',
                packageVersion: '3.0.0',
                downloadPath: 'c:\\output',
                project: 'MyProject',
            }));
        });
    });

    describe('Download Error Handling', function () {
        it('fails when artifact tool path is not set by pre-job', async () => {
            const tr = await TestHelpers.runTest({
                // Intentionally not setting artifactToolPath
                [testConstants.TestEnvVars.command]: 'download',
            });

            TestHelpers.assertFailure(tr);
            TestHelpers.assertStdoutContains(tr, testConstants.TestData.failedToGetArtifactTool);
            TestHelpers.assertStdoutContains(tr, testConstants.TestData.artifactToolPathNotSet);
        });

        it('fails when download returns non-zero exit code', async () => {
            const tr = await TestHelpers.runTest({
                [testConstants.TestEnvVars.artifactToolPath]: testConstants.TestData.defaultArtifactToolPath,
                [testConstants.TestEnvVars.command]: 'download',
                [testConstants.TestEnvVars.mockExitCode]: '1',
                [testConstants.TestEnvVars.mockStderr]: 'Download failed: package not found',
            });

            TestHelpers.assertFailure(tr);
            TestHelpers.assertStdoutContains(tr, testConstants.TestData.packagesFailedToDownload);
        });
    });
});
