// npm install mocha --save-dev
// typings install dt~mocha --save --global

import assert = require('assert');
import path = require('path');
import process = require('process');

import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('JenkinsDownloadArtifacts L0 Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    before((done) => {
        process.env['ENDPOINT_AUTH_ID1'] = '{\"scheme\":\"UsernamePassword\", \"parameters\": {\"username\": \"uname\", \"password\": \"pword\"}}';
        process.env['ENDPOINT_AUTH_PARAMETER_ID1_USERNAME'] = 'uname';
        process.env['ENDPOINT_AUTH_PARAMETER_ID1_PASSWORD'] = 'pword';
        process.env['ENDPOINT_URL_ID1'] = 'bogusURL';
        process.env['AGENT_TEMPDIRECTORY'] = '.';

        done();
    });

    it('run JenkinsDownloadArtifacts with no server endpoint', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'L0NoServerEndpoint.js'));
        await tr.runAsync();

        assert(tr.stdOutContained('Input required: serverEndpoint'));
        assert(tr.failed, 'task should have failed');
    });

    it('run JenkinsDownloadArtifacts with no save to', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'L0NoSaveTo.js'));

        await tr.runAsync();

        assert(tr.stdOutContained('Input required: saveTo'), 'should have written to stderr');
        assert(tr.failed, 'task should have failed');
    });

    it('run JenkinsDownloadArtifacts with no job name', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'L0NoJobName.js'));

        await tr.runAsync();
        assert(tr.stdOutContained('Input required: jobName'), 'should have written to stderr');
        assert(tr.failed, 'task should have failed');
    });

    it('Should download commits from legacy project build', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'L0ShouldDownloadCommitsFromLegacyProjectBuild.js'));

        await tr.runAsync();

        assert(tr.stdout.indexOf("GettingCommitsFromSingleBuild") !== -1, "Failed to fetch commits from single build");
        assert(tr.stdout.indexOf('20/api/json?tree=number,result,actions[remoteUrls],changeSet[kind,items[commitId,date,msg,author[fullName]]]') !== -1, "API parameter to fetch commits have changed");
    });

    it('Should download commits from single build', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'L0DownloadCommitsFromSingleBuild.js'));

        await tr.runAsync();

        assert(tr.stdout.indexOf("GettingCommitsFromSingleBuild") !== -1, "Failed to fetch commits from single build");
        assert(tr.stdout.indexOf('20/api/json?tree=number,result,actions[remoteUrls],changeSet[kind,items[commitId,date,msg,author[fullName]]]') !== -1, "API parameter to fetch commits have changed");
    });

    it('Validate github commit url', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'L0ValidateGitHubCommitUrl.js'));

        await tr.runAsync();

        assert(tr.stdout.indexOf('Translated url git@github.com:user/TestRepo.git/commit/3cbfc14e3f482a25e5122323f3273b89677d9875 to https://github.com/user/TestRepo/commit/3cbfc14e3f482a25e5122323f3273b89677d9875') !== -1, tr.stdout);
    });

    it('Validate gitlab commit url', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'L0ValidateGitLabCommitUrl.js'));

        await tr.runAsync();

        assert(tr.stdout.indexOf('Translated url git@gitlab.com:admin/projectk.git/commit/3cbfc14e3f482a25e5122323f3273b89677d9875 to https://gitlab.com/admin/projectk/commit/3cbfc14e3f482a25e5122323f3273b89677d9875') !== -1, tr.stdout);
    });

    it('Validate bitbucket commit url', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'L0ValidateBitBucketCommitUrl.js'));

        await tr.runAsync();

        assert(tr.stdout.indexOf('Translated url http://bitbucket.org/commits/3cbfc14e3f482a25e5122323f3273b89677d9875 after fixing the query path based on the provider') !== -1, tr.stdout);
    });

    it('Validate http commit url', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'L0ValidateHttpCommitUrl.js'));

        await tr.runAsync();

        assert(tr.stdout.indexOf('Translated url https://github.com/user/TestRepo/commit/3cbfc14e3f482a25e5122323f3273b89677d9875 to https://github.com/user/TestRepo/commit/3cbfc14e3f482a25e5122323f3273b89677d9875') !== -1, tr.stdout);
    });

    it('Validate invalid commit url', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'L0ValidateInvalidCommitUrl.js'));

        await tr.runAsync();

        assert(tr.stdout.indexOf('Translated url ssh://user@server/project.git/commit/3cbfc14e3f482a25e5122323f3273b89677d9875 to') !== -1, tr.stdout);
    });

    it('Should download commits from build range', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'L0DownloadCommitsFromBuildRange.js'));

        await tr.runAsync();

        assert(tr.stdout.indexOf('FoundBuildIndex') !== -1, "Failed to find the build index");
        assert(tr.stdout.indexOf('api/json?tree=builds[number,result,actions[remoteUrls],changeSet[kind,items[commitId,date,msg,author[fullName]]]]{2,4}') !== -1 , "API parameter to fetch commits range have changed");
    });

    it('Should download rollback commits', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'L0RollbackCommitsShouldBeDownloaded.js'));

        await tr.runAsync();

        assert(tr.stdout.indexOf('FoundBuildIndex') !== -1, "Failed to find the build index");
        assert(tr.stdout.indexOf('api/json?tree=builds[number,result,actions[remoteUrls],changeSet[kind,items[commitId,date,msg,author[fullName]]]]{2,4}') !== -1 , "API parameter to fetch commits range have changed");
    });

    it('No commits should be downloaded if both the jobId is same', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'L0NoCommitsShouldBeDownloaded.js'));

        await tr.runAsync();

        assert(tr.stdout.indexOf('FoundBuildIndex') === -1, "Should not try to find the build range");
        assert(tr.stdout.indexOf('changeSet[kind,items[commitId,date,msg,author[fullName]]]') === -1 , "Should not call jenkins api to fetch commits");
        assert(tr.stdout.indexOf('JenkinsNoCommitsToFetch') !== -1, "No commits should be downloaded");
    });

    it('run JenkinsDownloadArtifacts for propagated artifacts with Artifact Provider not as Azure Storage', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'L0UnkownArtifactProvider.js'));

        await tr.runAsync();

        assert(tr.stdOutContained('loc_mock_ArtifactProviderNotSupported'), tr.stderr);
        assert(tr.failed, 'task should have failed');
    });

    it('run JenkinsDownloadArtifacts for propagated artifacts with no azure server endpoint', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'L0NoAzureEndpointFailure.js'));

        await tr.runAsync();

        assert(tr.stdOutContained('Input required: ConnectedServiceNameARM'));
        assert(tr.failed, 'task should have failed');
    });

    it('run JenkinsDownloadArtifacts for propagated artifacts should run successfully', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'L0DownloadArtifactsFromAzureStorage.js'));

        await tr.runAsync();

        assert(tr.stdout.indexOf('loc_mock_ArtifactSuccessfullyDownloaded') !== -1, tr.stdout);
        assert(tr.succeeded, 'task should have succedded.');
    });

    it('Job type should be fetched even if its mentioned in the task input', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'L0JobTypeShouldAlwaysBeFetched.js'));

        await tr.runAsync();

        assert(tr.stdout.indexOf('Trying to get job type') !== -1, "Should try to find the job type");
    });

    it('Should fail if invalid buildId mentioned for MultiBranch job type', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'L0ShouldFailIfInvalidBuildIdMentionedForMultiBranch.js'));

        await tr.runAsync();

        assert(tr.stdout.indexOf('InvalidBuildId') !== -1, tr.stdout);
        assert(tr.failed, 'task should have failed');
    });

    it('Should fail if invalid buildId mentioned for Freestyle job type', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'L0ShouldFailIfInvalidBuildIdMentionedForFreeStyleJob.js'));

        await tr.runAsync();

        assert(tr.stdout.indexOf('InvalidBuildId') !== -1, tr.stdout);
        assert(tr.failed, 'task should have failed');
    });

    it('Should find jobId and branchName if its multibranch pipeline project', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'L0ShouldCorrectlyDetectMultiBranchPipelineProject.js'));

        await tr.runAsync();

        const expectedMessage = "Found Jenkins job details jobName:multibranchproject, jobType:org.jenkinsci.plugins.workflow.multibranch.WorkflowMultiBranchProject, buildId:20, IsMultiBranchPipeline:true, MultiBranchPipelineName:mybranch";
        assert(tr.stdout.indexOf(expectedMessage) !== -1, "Should correctly find the jobId and branchName if its multibranch project");
    });

    it('Should find jobId and branchName if its freestyle pipeline project', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'L0ShouldCorrectlyDetectFreeStyleProject.js'));

        await tr.runAsync();

        const expectedMessage = "Found Jenkins job details jobName:myfreestyleproject, jobType:hudson.model.FreeStyleProject, buildId:10, IsMultiBranchPipeline:false, MultiBranchPipelineName:undefined";
        assert(tr.stdout.indexOf(expectedMessage) !== -1, "Should correctly find the jobId if its freestyle project");

    });

    it('Should fetch the LastSuccesful build correctly when its Freestyle project', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'L0ShouldCorrectlyDetectLatestBuildForFreeStyleProject.js'));

        await tr.runAsync();

        const expectedMessage = "Found Jenkins job details jobName:myfreestyleproject, jobType:hudson.model.FreeStyleProject, buildId:100, IsMultiBranchPipeline:false, MultiBranchPipelineName:undefined";
        assert(tr.stdout.indexOf(expectedMessage) !== -1, "Should correctly find the Latest jobId  if its freestyle project");
    });

    it('Should fetch the LastSuccesful build correctly when its MultiBranch Pipeline project', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'L0ShouldCorrectlyDetectLatestBuildForMultiBranchPipelineProject.js'));

        await tr.runAsync();

        const expectedMessage = "Found Jenkins job details jobName:mymultibranchproject, jobType:org.jenkinsci.plugins.workflow.multibranch.WorkflowMultiBranchProject, buildId:200, IsMultiBranchPipeline:true, MultiBranchPipelineName:branch1";
        assert(tr.stdout.indexOf(expectedMessage) !== -1, "Should correctly find the Latest jobId  if its multibranch project");

    });

    it('Should have the correct url when downloading commits from multibranch pipeline project', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'L0FindingBuildRangeShouldHaveCorrectUrlIfItsMultiBranchPipelineProject.js'));

        await tr.runAsync();

        const expectedFindingBuildIndexApi = "http://url/job/testmultibranchproject//job/master/api/json?tree=allBuilds[number]";
        assert(tr.stdout.indexOf(expectedFindingBuildIndexApi) !== -1, "Should correctly find the build range when its multibranch project");

        const expectedDownloadCommitsApi = "http://url/job/testmultibranchproject//job/master/api/json?tree=builds[number,result,actions[remoteUrls],changeSet[kind,items[commitId,date,msg,author[fullName]]]]{2,4}";
        assert(tr.stdout.indexOf(expectedDownloadCommitsApi) !== -1 , "API to download multibranch pipeline job's commits is not correct");
    });


    it('Should throw if the start and end builds are from different branch in multibranch pipeline project', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'L0ShouldThrowIfBuildsAreFromDifferentBranchInMultiBranchProject.js'));

        await tr.runAsync();

        assert(tr.succeeded, 'task should not have failed'); // We don't fail the task if the downloading commits failed
        assert(tr.stdout.indexOf('CommitsAndWorkItemsDownloadFailed') !== -1, "Download Commits should have failed")

        const buildIndexApi = "http://url/job/testmultibranchproject//job/master/api/json?tree=allBuilds[number]";
        assert(tr.stdout.indexOf(buildIndexApi) === -1, "Should not try to find the build range");

        const downloadCommitsApi = "tree=builds[number,result,actions[remoteUrls],changeSet[kind,items[commitId,date,msg,author[fullName]]]]{2,4}";
        assert(tr.stdout.indexOf(downloadCommitsApi) === -1 , "Should not try to download the commits");
    });

    it('Should have the correct url if the job is under folder', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'L0FolderJobShouldHaveCorrectUrl.js'));

        await tr.runAsync();

        const expectedMessage = "Found Jenkins job details jobName:folder1/folder2/testmultibranchproject, jobType:org.jenkinsci.plugins.workflow.multibranch.WorkflowMultiBranchProject, buildId:20, IsMultiBranchPipeline:true, MultiBranchPipelineName:master";
        assert(tr.stdout.indexOf(expectedMessage) != -1, "Should correctly find the Latest job is inside a folder");

        const buildIndexApi = "http://url/job/folder1/job/folder2/job/testmultibranchproject//job/master/20/api/json?tree=number,result,actions[remoteUrls],changeSet[kind,items[commitId,date,msg,author[fullName]]]";
        assert(tr.stdout.indexOf(buildIndexApi) != -1, "Url for folder job should be correct");
    });

    it('Should retry if JenkinsClient encounters an error', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'L0ShouldRetryCorrectlyWhenErrorHappens.js'));

        await tr.runAsync();

        const expectedMessage = "RetryingOperation DownloadJsonContent 1";
        assert(tr.stdout.indexOf(expectedMessage) != -1, tr.stdout);
    });
});
