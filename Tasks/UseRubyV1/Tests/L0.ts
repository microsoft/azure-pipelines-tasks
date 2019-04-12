import * as assert from 'assert';
import * as path from 'path';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('UseRubyVersion L0 Suite', function () {

    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT || "60000"));
    before(function () {
    });

    after(function () {
    });

    it('finds version in cache in Linux', function () {
        let tp: string = path.join(__dirname, 'L0FindVersionInLinuxCache.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.succeeded, `task should have succeeded. error(s): ${tr.errorIssues}`);
        assert(tr.stdout.includes("task.setvariable variable=rubyLocation"), 'variable was not set as expected');
        assert(tr.stdout.includes('/Ruby/2.5.4/bin'), 'ruby location is not set as expected');
    });


    it('rejects version not in cache', function () {
        let tp: string = path.join(__dirname, 'L0RejectVersionNotInCache.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.failed, 'task should have failed');
        assert(tr.stdout.includes('loc_mock_VersionNotFound 3.x'), `error message not as expected ${tr.stdout}`);
        assert(tr.stdout.includes('loc_mock_ListAvailableVersions $(Agent.ToolsDirectory)'), 'list of available versions is not printed as expected');
        assert(tr.stdout.includes('2.7.13'), 'list of available versions is not printed as expected');
        assert(tr.stdout.includes('loc_mock_ToolNotFoundMicrosoftHosted Ruby https://aka.ms/hosted-agent-software'));
        assert(tr.stdout.includes('loc_mock_ToolNotFoundSelfHosted Ruby https://go.microsoft.com/fwlink/?linkid=2005989'));
    });

    it('sets PATH correctly on Linux', function () {
        let tp: string = path.join(__dirname, 'L0SetPathOnLinux.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.succeeded, `task should have succeeded. error(s): ${tr.errorIssues}`);
        assert(tr.stdout.includes("task.setvariable variable=rubyLocation"), 'variable was not set as expected');
        assert(tr.stdout.includes('/Ruby/2.4.4/bin'), 'ruby location is not set as expected');
        assert(tr.stdout.includes('##vso[task.prependpath]' + '/Ruby/2.4.4/bin'), 'ruby tool location was not added to PATH as expected');
    });

    it('sets PATH correctly on Windows', function () {
        let tp: string = path.join(__dirname, 'L0SetPathOnWindows.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.succeeded, `task should have succeeded. error(s): ${tr.errorIssues}`);
        assert(tr.stdout.includes("task.setvariable variable=rubyLocation"), 'variable was not set as expected');
        assert(tr.stdout.includes('\\Ruby\\2.4.4\\bin'), 'ruby location is not set as expected');
        assert(tr.stdout.includes('##vso[task.prependpath]' + '\\Ruby\\2.4.4\\bin'), 'ruby tool location was not added to PATH as expected');
    });

    it('sets proxy correctly', function() {
        let tp: string = path.join(__dirname, 'L0SetProxy.js');
        // Http url
        process.env['__proxy_url__'] = 'http://url.tld';
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        delete process.env["__proxy_url__"];

        assert(tr.succeeded, `task should have succeeded. error(s): ${tr.errorIssues}`);
        assert(tr.stdout.includes("Setting http_proxy to http://url.tld/"), 'http_proxy was not set as expected');

        // Https url
        process.env['__proxy_url__'] = 'https://url.tld';
        process.env['__proxy_username__'] = 'username';
        process.env['__proxy_password__'] = 'password';
        tr = new ttm.MockTestRunner(tp);

        tr.run();
        delete process.env["__proxy_url__"];
        delete process.env["__proxy_username__"];
        delete process.env["__proxy_password__"]

        assert(tr.succeeded, `task should have succeeded. error(s): ${tr.errorIssues}`);
        assert(tr.stdout.includes("Setting https_proxy to https://username:password@url.tld/"), 'https_proxy was not set as expected');
        assert(tr.stdout.includes("Setting secret password"), 'proxy password was not set as a secret as expected');
    });
});
