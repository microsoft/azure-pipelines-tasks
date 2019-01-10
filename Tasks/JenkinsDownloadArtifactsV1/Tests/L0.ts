// npm install mocha --save-dev
// typings install dt~mocha --save --global

import assert = require('assert');
import path = require('path');
import os = require('os');
import process = require('process');
import fs = require('fs');

import * as ttm from 'vsts-task-lib/mock-test';

describe('JenkinsDownloadArtifacts L0 Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    before((done) => {
        process.env['ENDPOINT_AUTH_ID1'] = '{\"scheme\":\"UsernamePassword\", \"parameters\": {\"username\": \"uname\", \"password\": \"pword\"}}';
        process.env['ENDPOINT_AUTH_PARAMETER_ID1_USERNAME'] = 'uname';
        process.env['ENDPOINT_AUTH_PARAMETER_ID1_PASSWORD'] = 'pword';
        process.env['ENDPOINT_URL_ID1'] = 'bogusURL';

        done();
    });

    /* tslint:disable:no-empty */
    after(function () { });
    /* tslint:enable:no-empty */

    it('run JenkinsDownloadArtifacts with no server endpoint', (done) => {
        const tp: string = path.join(__dirname, 'L0NoServerEndpoint.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();
            assert(tr.stdOutContained('Input required: serverEndpoint'));
            assert(tr.failed, 'task should have failed');
            done();

            //assert(tr.ran(gradleWrapper + ' build'), 'it should have run gradlew build');
            //assert(tr.invokedToolCount === 1, 'should have only run gradle 1 time');
            //assert(tr.stderr.length === 0, 'should not have written to stderr');
            //assert(tr.succeeded, 'task should have succeeded');
            //assert(tr.stdout.indexOf('GRADLE_OPTS is now set to -Xmx2048m') > 0);
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

     it('run JenkinsDownloadArtifacts with no save to', (done) => {
        const tp: string = path.join(__dirname, 'L0NoSaveTo.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.stdOutContained('Input required: saveTo'), 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('run JenkinsDownloadArtifacts with no job name', (done) => {
        const tp: string = path.join(__dirname, 'L0NoJobName.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();
            assert(tr.stdOutContained('Input required: jobName'), 'should have written to stderr');
            assert(tr.failed, 'task should have failed');
            done();
        } catch (err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Should download commits from legacy project build', (done) => {

        const tp: string = path.join(__dirname, 'L0ShouldDownloadCommitsFromLegacyProjectBuild.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.stdout.indexOf("GettingCommitsFromSingleBuild") !== -1, "Failed to fetch commits from single build");
            assert(tr.stdout.indexOf('20/api/json?tree=number,result,actions[remoteUrls],changeSet[kind,items[commitId,date,msg,author[fullName]]]') !== -1, "API parameter to fetch commits have changed");

            done();
        } catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });
    
    it('Should download commits from single build', (done) => {

        const tp: string = path.join(__dirname, 'L0DownloadCommitsFromSingleBuild.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.stdout.indexOf("GettingCommitsFromSingleBuild") !== -1, "Failed to fetch commits from single build");
            assert(tr.stdout.indexOf('20/api/json?tree=number,result,actions[remoteUrls],changeSet[kind,items[commitId,date,msg,author[fullName]]]') !== -1, "API parameter to fetch commits have changed");

            done();
        } catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Validate github commit url', (done) => {

        const tp: string = path.join(__dirname, 'L0ValidateGitHubCommitUrl.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.stdout.indexOf('Translated url git@github.com:user/TestRepo.git/commit/3cbfc14e3f482a25e5122323f3273b89677d9875 to https://github.com/user/TestRepo/commit/3cbfc14e3f482a25e5122323f3273b89677d9875') !== -1, tr.stdout);

            done();
        } catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Validate gitlab commit url', (done) => {

        const tp: string = path.join(__dirname, 'L0ValidateGitLabCommitUrl.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.stdout.indexOf('Translated url git@gitlab.com:admin/projectk.git/commit/3cbfc14e3f482a25e5122323f3273b89677d9875 to https://gitlab.com/admin/projectk/commit/3cbfc14e3f482a25e5122323f3273b89677d9875') !== -1, tr.stdout);

            done();
        } catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });
    
    it('Validate bitbucket commit url', (done) => {

        const tp: string = path.join(__dirname, 'L0ValidateBitBucketCommitUrl.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.stdout.indexOf('Translated url http://bitbucket.org/commits/3cbfc14e3f482a25e5122323f3273b89677d9875 after fixing the query path based on the provider') !== -1, tr.stdout);

            done();
        } catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Validate http commit url', (done) => {

        const tp: string = path.join(__dirname, 'L0ValidateHttpCommitUrl.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.stdout.indexOf('Translated url https://github.com/user/TestRepo/commit/3cbfc14e3f482a25e5122323f3273b89677d9875 to https://github.com/user/TestRepo/commit/3cbfc14e3f482a25e5122323f3273b89677d9875') !== -1, tr.stdout);

            done();
        } catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Validate invalid commit url', (done) => {

        const tp: string = path.join(__dirname, 'L0ValidateInvalidCommitUrl.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.stdout.indexOf('Translated url ssh://user@server/project.git/commit/3cbfc14e3f482a25e5122323f3273b89677d9875 to') !== -1, tr.stdout);

            done();
        } catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Should download commits from build range', (done) => {
        const tp: string = path.join(__dirname, 'L0DownloadCommitsFromBuildRange.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.stdout.indexOf('FoundBuildIndex') !== -1, "Failed to find the build index");
            assert(tr.stdout.indexOf('api/json?tree=builds[number,result,actions[remoteUrls],changeSet[kind,items[commitId,date,msg,author[fullName]]]]{2,4}') !== -1 , "API parameter to fetch commits range have changed");

            done();
        } catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Should download rollback commits', (done) => {

        const tp: string = path.join(__dirname, 'L0RollbackCommitsShouldBeDownloaded.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.stdout.indexOf('FoundBuildIndex') !== -1, "Failed to find the build index");
            assert(tr.stdout.indexOf('api/json?tree=builds[number,result,actions[remoteUrls],changeSet[kind,items[commitId,date,msg,author[fullName]]]]{2,4}') !== -1 , "API parameter to fetch commits range have changed");

            done();
        } catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('No commits should be downloaded if both the jobId is same', (done) => {
        const tp: string = path.join(__dirname, 'L0NoCommitsShouldBeDownloaded.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.stdout.indexOf('FoundBuildIndex') === -1, "Should not try to find the build range");
            assert(tr.stdout.indexOf('changeSet[kind,items[commitId,date,msg,author[fullName]]]') === -1 , "Should not call jenkins api to fetch commits");
            assert(tr.stdout.indexOf('JenkinsNoCommitsToFetch') !== -1, "No commits should be downloaded");

            done();
        } catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('run JenkinsDownloadArtifacts for propagated artifacts with Artifact Provider not as Azure Storage', (done) => {
        const tp: string = path.join(__dirname, 'L0UnkownArtifactProvider.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try{
            tr.run();

            assert(tr.stdOutContained('loc_mock_ArtifactProviderNotSupported'), tr.stderr);
            assert(tr.failed, 'task should have failed');
            done();
        }
        catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('run JenkinsDownloadArtifacts for propagated artifacts with no azure server endpoint', (done) => {
        const tp: string = path.join(__dirname, 'L0NoAzureEndpointFailure.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try{
            tr.run();

            assert(tr.stdOutContained('Input required: ConnectedServiceNameARM'));
            assert(tr.failed, 'task should have failed');
            done();
        }
        catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('run JenkinsDownloadArtifacts for propagated artifacts should run successfully', (done) => {
        const tp: string = path.join(__dirname, 'L0DownloadArtifactsFromAzureStorage.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try{
            tr.run();

            assert(tr.stdout.indexOf('loc_mock_ArtifactSuccessfullyDownloaded') !== -1, tr.stdout);
            assert(tr.succeeded, 'task should have succedded.');
            done();
        }
        catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Job type should be fetched even if its mentioned in the task input', (done) => {
        const tp: string = path.join(__dirname, 'L0JobTypeShouldAlwaysBeFetched.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.stdout.indexOf('Trying to get job type') !== -1, "Should try to find the job type");

            done();
        } catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Should fail if invalid buildId mentioned for MultiBranch job type', (done) => {
        const tp: string = path.join(__dirname, 'L0ShouldFailIfInvalidBuildIdMentionedForMultiBranch.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.stdout.indexOf('InvalidBuildId') !== -1, tr.stdout);
            assert(tr.failed, 'task should have failed');

            done();
        } catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Should fail if invalid buildId mentioned for Freestyle job type', (done) => {
        const tp: string = path.join(__dirname, 'L0ShouldFailIfInvalidBuildIdMentionedForFreeStyleJob.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.stdout.indexOf('InvalidBuildId') !== -1, tr.stdout);
            assert(tr.failed, 'task should have failed');

            done();
        } catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Should find jobId and branchName if its multibranch pipeline project', (done) => {
        const tp: string = path.join(__dirname, 'L0ShouldCorrectlyDetectMultiBranchPipelineProject.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            let expectedMessage: string = "Found Jenkins job details jobName:multibranchproject, jobType:org.jenkinsci.plugins.workflow.multibranch.WorkflowMultiBranchProject, buildId:20, IsMultiBranchPipeline:true, MultiBranchPipelineName:mybranch";
            assert(tr.stdout.indexOf(expectedMessage) !== -1, "Should correctly find the jobId and branchName if its multibranch project");

            done();
        } catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Should find jobId and branchName if its freestyle pipeline project', (done) => {
        const tp: string = path.join(__dirname, 'L0ShouldCorrectlyDetectFreeStyleProject.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            let expectedMessage: string = "Found Jenkins job details jobName:myfreestyleproject, jobType:hudson.model.FreeStyleProject, buildId:10, IsMultiBranchPipeline:false, MultiBranchPipelineName:undefined";
            assert(tr.stdout.indexOf(expectedMessage) !== -1, "Should correctly find the jobId if its freestyle project");

            done();
        } catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Should fetch the LastSuccesful build correctly when its Freestyle project', (done) => {
        const tp: string = path.join(__dirname, 'L0ShouldCorrectlyDetectLatestBuildForFreeStyleProject.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            let expectedMessage: string = "Found Jenkins job details jobName:myfreestyleproject, jobType:hudson.model.FreeStyleProject, buildId:100, IsMultiBranchPipeline:false, MultiBranchPipelineName:undefined";
            assert(tr.stdout.indexOf(expectedMessage) !== -1, "Should correctly find the Latest jobId  if its freestyle project");

            done();
        } catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Should fetch the LastSuccesful build correctly when its MultiBranch Pipeline project', (done) => {
        const tp: string = path.join(__dirname, 'L0ShouldCorrectlyDetectLatestBuildForMultiBranchPipelineProject.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            let expectedMessage: string = "Found Jenkins job details jobName:mymultibranchproject, jobType:org.jenkinsci.plugins.workflow.multibranch.WorkflowMultiBranchProject, buildId:200, IsMultiBranchPipeline:true, MultiBranchPipelineName:branch1";
            assert(tr.stdout.indexOf(expectedMessage) !== -1, "Should correctly find the Latest jobId  if its multibranch project");

            done();
        } catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Should have the correct url when downloading commits from multibranch pipeline project', (done) => {
        const tp: string = path.join(__dirname, 'L0FindingBuildRangeShouldHaveCorrectUrlIfItsMultiBranchPipelineProject.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();
            let expectedFindingBuildIndexApi: string = "http://url/job/testmultibranchproject//job/master/api/json?tree=allBuilds[number]";
            assert(tr.stdout.indexOf(expectedFindingBuildIndexApi) !== -1, "Should correctly find the build range when its multibranch project");

            let expectedDownloadCommitsApi: string = "http://url/job/testmultibranchproject//job/master/api/json?tree=builds[number,result,actions[remoteUrls],changeSet[kind,items[commitId,date,msg,author[fullName]]]]{2,4}";
            assert(tr.stdout.indexOf(expectedDownloadCommitsApi) !== -1 , "API to download multibranch pipeline job's commits is not correct");

            done();
        } catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });


    it('Should throw if the start and end builds are from different branch in multibranch pipeline project', (done) => {
        const tp: string = path.join(__dirname, 'L0ShouldThrowIfBuildsAreFromDifferentBranchInMultiBranchProject.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.succeeded, 'task should not have failed'); // We don't fail the task if the downloading commits failed
            assert(tr.stdout.indexOf('CommitsAndWorkItemsDownloadFailed') !== -1, "Download Commits should have failed")

            let buildIndexApi: string = "http://url/job/testmultibranchproject//job/master/api/json?tree=allBuilds[number]";
            assert(tr.stdout.indexOf(buildIndexApi) === -1, "Should not try to find the build range");

            let downloadCommitsApi: string = "tree=builds[number,result,actions[remoteUrls],changeSet[kind,items[commitId,date,msg,author[fullName]]]]{2,4}";
            assert(tr.stdout.indexOf(downloadCommitsApi) === -1 , "Should not try to download the commits");

            done();
        } catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Should have the correct url if the job is under folder', (done) => {
        const tp: string = path.join(__dirname, 'L0FolderJobShouldHaveCorrectUrl.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            let expectedMessage: string = "Found Jenkins job details jobName:folder1/folder2/testmultibranchproject, jobType:org.jenkinsci.plugins.workflow.multibranch.WorkflowMultiBranchProject, buildId:20, IsMultiBranchPipeline:true, MultiBranchPipelineName:master";
            assert(tr.stdout.indexOf(expectedMessage) != -1, "Should correctly find the Latest job is inside a folder");

            let buildIndexApi: string = "http://url/job/folder1/job/folder2/job/testmultibranchproject//job/master/20/api/json?tree=number,result,actions[remoteUrls],changeSet[kind,items[commitId,date,msg,author[fullName]]]";
            assert(tr.stdout.indexOf(buildIndexApi) != -1, "Url for folder job should be correct");

            done();
        } catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });

    it('Should retry if JenkinsClient encounters an error', (done) => {
        const tp: string = path.join(__dirname, 'L0ShouldRetryCorrectlyWhenErrorHappens.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            let expectedMessage: string = "RetryingOperation DownloadJsonContent 1";
            assert(tr.stdout.indexOf(expectedMessage) != -1, tr.stdout);

            done();
        } catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    });
});
