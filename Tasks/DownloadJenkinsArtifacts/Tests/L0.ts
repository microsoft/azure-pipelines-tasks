import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';
import * as path from 'path';
import tl = require('vsts-task-lib');

var hbs = require('handlebars').create();

describe('Download Jenkins Artifact Details L0 Suite', function () {
    this.timeout(20000);

    before(function () { });
    after(function () { });

    it('Should download commits from single build', (done) => {

        const tp: string = path.join(__dirname, 'L0DownloadCommitsFromSingleBuild.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        try {
            tr.run();

            assert(tr.stdout.indexOf('Downloading commits from the job 20') !== -1 , "Failed to fetch commits from single build");
            assert(tr.stdout.indexOf('20/api/json?tree=number,result,actions[remoteUrls],changeSet[kind,items[commitId,date,msg,author[fullName]]]') !== -1, "API parameter to fetch commits have changed");

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

            assert(tr.stdout.indexOf('Found startIndex 4 and endIndex 2') !== -1, "Failed to find the build index correctly");
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

            assert(tr.stdout.indexOf('Found startIndex 4 and endIndex 2') !== -1, "Failed to find the build index correctly");
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

            assert(tr.stdout.indexOf('Found startIndex') === -1, "Should not try to find the build range");
            assert(tr.stdout.indexOf('changeSet[kind,items[commitId,date,msg,author[fullName]]]') === -1 , "Should not call jenkins api to fetch commits");
            assert(tr.stdout.indexOf('JenkinsNoCommitsToFetch') !== -1, "No commits should be downloaded");

            done();
        } catch(err) {
            console.log(tr.stdout);
            console.log(tr.stderr);
            console.log(err);
            done(err);
        }
    })
});
