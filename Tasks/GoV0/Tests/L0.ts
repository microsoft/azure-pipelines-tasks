'use strict';

const assert = require('assert');
const tl = require('azure-pipelines-task-lib');
const ttm = require('azure-pipelines-task-lib/mock-test');
const path = require('path');

function setResponseFile(name) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('GoToolInstaller', function () {
    this.timeout(30000);

    it("go get should succeed", async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, "GoGetSuccess.js"));
        await tr.runAsync();

        assert(tr.succeeded, "Should have succeeded");
        assert(tr.stdout.indexOf("[command]C:\\somedir\\go get") > -1, "should print the command to run");
    });

    it("go get should fail", async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, "GoGetFail.js"));
        await tr.runAsync();

        assert(tr.failed, "Should have failed");
        assert(tr.stdout.indexOf("[command]C:\\somedir\\go get") > -1, "should print the command to run");
        assert(tr.stdout.indexOf("go get failure message") > -1, "should print the failure message");
    });

    it("go build should succeed with arguments", async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, "GoBuildSuccess.js"));
        await tr.runAsync();

        assert(tr.succeeded, "Should have succeeded");
        assert(tr.stdout.indexOf("[command]C:\\somedir\\go build -o outDir") > -1, "should print the command to run");
    });

    it("go build should fail with argument", async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, "GoBuildFail.js"));
        await tr.runAsync();

        assert(tr.failed, "Should have failed");
        assert(tr.stdout.indexOf("[command]C:\\somedir\\go build -o outDir") > -1, "should print the command to run");
        assert(tr.stdout.indexOf("go build failure message") > -1, "should print the failure message");
    });

    it("go custom command should succeed", async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, "GoCustomVersionSuccess.js"));
        await tr.runAsync();

        assert(tr.succeeded, "Should have succeeded");
        assert(tr.stdout.indexOf("[command]C:\\somedir\\go version") > -1, "should print the command to run");
        assert(tr.stdout.indexOf("current version of go is 1.9.3") > -1, "should print the command to run");
    });

    it("go custom command should fail", async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, "GoCustomVersionFail.js"));
        await tr.runAsync();

        assert(tr.failed, "Should have failed");
        assert(tr.stdout.indexOf("[command]C:\\somedir\\go version") > -1, "should print the command to run");
        assert(tr.stdout.indexOf("go version failure message") > -1, "should print the failure message");
    });
});
