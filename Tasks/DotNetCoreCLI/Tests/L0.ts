import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';
import os = require('os');
import fs = require('fs');

describe('DotNetCoreExe Suite', function () {
    before(() => {
    });

   after(function () {
    });

    it('fails if the dotnet tool is not found', (done: MochaDone) => {
        let tp = path.join(__dirname, 'dotnetExeNotFound.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 0, 'should not have invoked any tool');
        assert(tr.failed, 'task should have failed');
        assert(tr.errorIssues.length > 0, "error reason should have been recorded");
        done();
    }),

    it ('restore works with explicit project files', (done: MochaDone) => {

        process.env["__projects__"] = '**/project.json';
        let tp = path.join(__dirname, 'validInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 4, 'should have invoked tool.');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    }),

    it ('restore works with no project file is specified', (done: MochaDone) => {

        process.env["__projects__"] = "";
        let tp = path.join(__dirname, 'validInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool once');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    }),

     it ('restore fails with when the dotnet restore fails', (done: MochaDone) => {

        process.env["__projects__"] = "dummy/project.json";
        let tp = path.join(__dirname, 'validInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool once');
        assert(tr.failed, 'task should have failed');
        done();
    })

    it ('publish works with explicit project files', (done: MochaDone) => {

        process.env["__projects__"] = '**/project.json';
        let tp = path.join(__dirname, 'publishInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 4, 'should have invoked tool');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    }),

    it ('publish works with no project file is specified', (done: MochaDone) => {

        process.env["__projects__"] = "";
        let tp = path.join(__dirname, 'publishInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool once');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    }),

    it ('publish fails with when the dotnet publish fails', (done: MochaDone) => {

        process.env["__projects__"] = "dummy/project.json";
        let tp = path.join(__dirname, 'publishInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 1, 'should have invoked tool once');
        assert(tr.failed, 'task should have failed');
        done();
    }),

    it ('publish is successful with warning when the project file pattern return zero match', (done: MochaDone) => {
        process.env["__projects__"] = "*fail*/project.json"
        process.env["__publishWebProjects__"] = "false";
        let tp = path.join(__dirname, 'publishInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 0, 'should not have invoked tool');
        assert(tr.succeeded, 'task should have failed');
        assert(tr.warningIssues && tr.warningIssues.length, "No warning was reported for this issue.")
        done();
    }),


    it ('publish works with publishWebProjects option', (done: MochaDone) => {

        process.env["__projects__"] = "dummy/project.json"; // this to verify that we ignore this.
        process.env["__publishWebProjects__"] = "true";
        let tp = path.join(__dirname, 'publishInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 2, 'should have invoked tool twice');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    }),

    it ('publish updates the output with the project name appended', (done: MochaDone) => {
        process.env["__projects__"] = "*customoutput/project.json";
        process.env["__publishWebProjects__"] = "false";
        process.env["__arguments__"] = "--configuration release --output /usr/out"
        let tp = path.join(__dirname, 'publishInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        assert(tr.invokedToolCount == 2, 'should have invoked tool two times');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    }),

    it ('publish works with zipAfterPublish option', (done: MochaDone) => {
        // TODO
        done();
    }),

    it ('publish works with zipAfterPublish and publishWebProjects option with no project file specified', (done: MochaDone) => {
        process.env["__projects__"] = "";
        process.env["__publishWebProjects__"] = "false";
        process.env["__arguments__"] = "--configuration release --output /usr/out"
        let tp = path.join(__dirname, 'publishInputs.js')
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();

        // TODO: Add Zip

        assert(tr.invokedToolCount == 1, 'should have invoked tool two times');
        assert(tr.succeeded, 'task should have succeeded');
        done();
    })
});