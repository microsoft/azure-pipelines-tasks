import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';
import tl = require('vsts-task-lib');

describe('Docker Suite', function() {
    this.timeout(30000);
    before((done) => {
        done();
    });
    after(function () {
    });

    if(tl.osType().match(/^Win/)) {
        it('Runs successfully for windows docker build', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Build an image";
            tr.run();

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker build -f F:\\dir1\\DockerFile -t test/test:2") != -1, "docker build should run");
            console.log(tr.stderr);
            done();
        });

        it('Runs successfully for windows docker build with latest tag', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Build an image";
            process.env["__includeLatestTag__"] = "true";
            tr.run();
            process.env["__includeLatestTag__"] = "false";

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker build -f F:\\dir1\\DockerFile -t test/test:2 -t test/test") != -1, "docker build should run");
            console.log(tr.stderr);
            done();
        });

        it('Runs successfully for windows docker run image', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Run an image";
            tr.run();
            process.env["__command__"] = "Build an image";

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker run --rm test/test:2") != -1, "docker run should run");
            console.log(tr.stderr);
            done();
        });

        it('Runs successfully for windows docker push image', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Push an image";
            tr.run();
            process.env["__command__"] = "Build an image";
            console.log(tr.stdout);

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker push test/test:2") != -1, "docker push should run");
            console.log(tr.stderr);
            done();
        });

        it('Runs successfully for windows docker pull image', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0Windows.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env["__command__"] = "Run a Docker command";
            tr.run();
            process.env["__command__"] = "Build an image";

            assert(tr.invokedToolCount == 1, 'should have invoked tool one times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdout.indexOf("[command]docker pull test/test:2") != -1, "docker pull should run");
            console.log(tr.stderr);
            done();
        });

    } else {
        it('Runs successfully for linux template', (done:MochaDone) => {
            let tp = path.join(__dirname, 'L0Linux.js');
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();
            
            assert(tr.invokedToolCount == 4, 'should have invoked tool four times. actual: ' + tr.invokedToolCount);
            assert(tr.stderr.length == 0 || tr.errorIssues.length, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');

            done();
        });
    }
});
