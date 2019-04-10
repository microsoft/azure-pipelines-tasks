import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

function runValidations(validator: () => void, tr, done) {
    try {
        validator();
        done();
    }
    catch (error) {
        console.log("STDERR", tr.stderr);
        console.log("STDOUT", tr.stdout);
        done(error);
    }
}

describe('GoTool Suite', function () {
    this.timeout(60000);

    it('Succeeds when the tool is downloaded', (done: MochaDone) => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0Download.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.succeeded, 'GoTool should have succeeded.');
            assert(tr.stderr.length === 0, 'GoTool should not have written to stderr');
            assert(tr.stdout.indexOf('Downloaded tool') > -1, 'Tool should be downloaded');
            assert(tr.stdout.indexOf('Extracting zip') > -1, 'Tool should be extracted');
            assert(tr.stdout.indexOf('Caching tool') > -1, 'Tool should be cached');
        }, tr, done);
    });

    it('Succeeds when the tool is cached', (done: MochaDone) => {
        this.timeout(5000);

        process.env["__local_cache__"] = 'true';
        let tp: string = path.join(__dirname, 'L0Download.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        delete process.env["__local_cache__"];

        runValidations(() => {
            assert(tr.succeeded, 'GoTool should have succeeded.');
            assert(tr.stderr.length === 0, 'GoTool should not have written to stderr');
            assert(tr.stdout.indexOf('Downloaded tool') <= -1, 'Tool should not be downloaded');
            assert(tr.stdout.indexOf('Found tool locally') > -1, 'Tool should be found');
            assert(tr.stdout.indexOf('Extracting zip') <= -1, 'Tool should not be extracted');
            assert(tr.stdout.indexOf('Caching tool') <= -1, 'Tool should not be cached again');
        }, tr, done);
    });

    it('Succeeds with different os/arch', (done: MochaDone) => {
        this.timeout(5000);
        
        process.env['__linux__'] = 'true';
        let tp: string = path.join(__dirname, 'L0Download.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        delete process.env["__linux__"];

        runValidations(() => {
            assert(tr.succeeded, 'GoTool should have succeeded.');
            assert(tr.stderr.length === 0, 'GoTool should not have written to stderr');
            assert(tr.stdout.indexOf('Downloaded tool') > -1, 'Tool should be downloaded');
            assert(tr.stdout.indexOf('Extracting tar') > -1, 'Tool should be extracted');
            assert(tr.stdout.indexOf('Caching tool') > -1, 'Tool should be cached');
        }, tr, done);
    });

    it('Sets the environment variables correctly', (done: MochaDone) => {
        this.timeout(5000);

        process.env["__go_env__"] = 'true';
        let tp: string = path.join(__dirname, 'L0Download.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        delete process.env["__go_env__"];

        runValidations(() => {
            assert(tr.succeeded, 'GoTool should have succeeded.');
            assert(tr.stderr.length === 0, 'GoTool should not have written to stderr');
            assert(tr.stdout.indexOf('Setting GOROOT to cachedToolPath') > -1, 'GOROOT should be set');
            assert(tr.stdout.indexOf('Setting GOPATH to myGoPath') > -1, 'GOPATH should be set');
            assert(tr.stdout.indexOf('Setting GOBIN to myGoBin') > -1, 'GOBIN should be set');
        }, tr, done);
    });

    it('Sets proxy correctly', (done: MochaDone) => {
        // TODO
        this.timeout(5000);

        process.env["__proxy__"] = "true";
        let tp: string = path.join(__dirname, 'L0Download.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        delete process.env["__proxy__"];

        runValidations(() => {
            assert(tr.succeeded, 'GoTool should have succeeded.');
            assert(tr.stderr.length === 0, 'GoTool should not have written to stderr');
            assert(tr.stdout.indexOf('Setting secret password') > -1, "Password should be set");
            assert(tr.stdout.indexOf('Setting HTTP_PROXY to http://username:password@url.com/') > -1, "Proxy should be set");
        }, tr, done);
    });
});