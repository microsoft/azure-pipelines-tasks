'use strict';

const assert = require('assert');
const tl = require('azure-pipelines-task-lib');
const ttm = require('azure-pipelines-task-lib/mock-test');
const path = require('path');

function setResponseFile(name) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

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

describe('GoToolInstaller', function () {
    this.timeout(30000);
    before((done) => {
        done();
    });
    after(function () {
    });

    it("go get should succeed", (done) => {
        let tp = path.join(__dirname, "GoGetSuccess.js");
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        runValidations(() => {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("[command]C:\\somedir\\go get") > -1, "should print the command to run");
        }, tr, done);
    });

    it("go get should fail", (done) => {
        let tp = path.join(__dirname, "GoGetFail.js");
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        runValidations(() => {
            assert(tr.failed, "Should have failed");
            assert(tr.stdout.indexOf("[command]C:\\somedir\\go get") > -1, "should print the command to run");
            assert(tr.stdout.indexOf("go get failure message") > -1, "should print the failure message");
        }, tr, done);
    });
    it("go build should succeed with arguments", (done) => {
        let tp = path.join(__dirname, "GoBuildSuccess.js");
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        runValidations(() => {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("[command]C:\\somedir\\go build -o outDir") > -1, "should print the command to run");
        }, tr, done);
    });

    it("go build should fail with argument", (done) => {
        let tp = path.join(__dirname, "GoBuildFail.js");
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        runValidations(() => {
            assert(tr.failed, "Should have failed");
            assert(tr.stdout.indexOf("[command]C:\\somedir\\go build -o outDir") > -1, "should print the command to run");
            assert(tr.stdout.indexOf("go build failure message") > -1, "should print the failure message");
        }, tr, done);
    });
    it("go custom command should succeed", (done) => {
        let tp = path.join(__dirname, "GoCustomVersionSuccess.js");
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        runValidations(() => {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("[command]C:\\somedir\\go version") > -1, "should print the command to run");
            assert(tr.stdout.indexOf("current version of go is 1.9.3") > -1, "should print the command to run");
        }, tr, done);
    });

    it("go custom command should fail", (done) => {
        let tp = path.join(__dirname, "GoCustomVersionFail.js");
        let tr = new ttm.MockTestRunner(tp);
        tr.run();
        runValidations(() => {
            assert(tr.failed, "Should have failed");
            assert(tr.stdout.indexOf("[command]C:\\somedir\\go version") > -1, "should print the command to run");
            assert(tr.stdout.indexOf("go version failure message") > -1, "should print the failure message");
        }, tr, done);
    });
});
