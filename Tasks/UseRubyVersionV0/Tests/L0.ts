import * as assert from 'assert';
import * as path from 'path';
import * as ttm from 'vsts-task-lib/mock-test';

describe('UseRubyVersion L0 Suite', function () {

    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
    before(() => {
    });

    after(() => {
    });

    it('finds version in cache in Linux', function (done: MochaDone) {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0FindVersionInLinuxCache.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.includes("task.setvariable variable=rubyLocation"), 'variable was not set as expected');
        assert(tr.stdout.includes(path.join('/', 'Ruby', '2.5.4', 'bin')), 'ruby location is not set as expected');

        done();
    });


    it('rejects version not in cache', function (done: MochaDone) {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0RejectVersionNotInCache.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.failed, 'task should have failed');
        assert(tr.stdout.includes('loc_mock_VersionNotFound 3.x'), 'error message not as expected');
        assert(tr.stdout.includes('loc_mock_ListAvailableVersions'), 'list of available versions is not printed as expected');
        assert(tr.stdout.includes('2.7.13'), 'list of available versions is not printed as expected');

        done();
    });

    it('sets PATH correctly on Linux', function (done: MochaDone) {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0SetPathOnLinux.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.includes("task.setvariable variable=rubyLocation"), 'variable was not set as expected');
        assert(tr.stdout.includes(path.join('/', 'Ruby', '2.4.4', 'bin')), 'ruby location is not set as expected');
        assert(tr.stdout.includes('##vso[task.prependpath]' + path.join('/', 'Ruby', '2.4.4', 'bin')), 'ruby tool location was not added to PATH as expected');
        done();
    });

    it('sets PATH correctly on Windows', function (done: MochaDone) {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0SetPathOnWindows.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.stdout.includes("task.setvariable variable=rubyLocation"), 'variable was not set as expected');
        assert(tr.stdout.includes(path.join('/', 'Ruby', '2.4.4', 'bin')), 'ruby location is not set as expected');
        assert(tr.stdout.includes('##vso[task.prependpath]' + path.join('/', 'Ruby', '2.4.4', 'bin')), 'ruby tool location was not added to PATH as expected');
        done();
    });
});
