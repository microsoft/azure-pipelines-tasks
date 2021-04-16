import * as assert from "assert";
import * as path from "path";

import { MockTestRunner } from "azure-pipelines-task-lib/mock-test";

describe("XamarinAndroid L0 Suite", function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    before(() => {
        process.env['MOCK_NORMALIZE_SLASHES'] = 'true';
    });

    after(() => {

    });

    it("run XamarinAndroid with default inputs", (done: Mocha.Done) => {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT || "") || 20000);

        const testPath = path.join(__dirname, "L0DefaultInputs.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        assert(testRunner.ran("/home/bin/xbuild /user/build/fun/project.csproj /t:PackageForAndroid"), "it should have run xamarin android");
        assert(testRunner.invokedToolCount == 1, "should have only run XamarinAndroid 1 time");
        assert(testRunner.stderr.length == 0, "should not have written to stderr");
        assert(testRunner.succeeded, "task should have succeeded");

        done();
    });

    it("run XamarinAndroid with project missing", (done: Mocha.Done) => {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT || "") || 20000);

        const testPath = path.join(__dirname, "L0MissingProject.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        assert(testRunner.failed, "task should have failed");
        assert(testRunner.createdErrorIssue("Error: Input required: project"), "task did not throw expected error, errors thrown: " + testRunner.errorIssues);
        assert(testRunner.invokedToolCount == 0, "task should not have run XamarinAndroid");

        done();
    });

    it("XamarinAndroid uses msbuild 15 on macOS", (done: Mocha.Done) => {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT || "") || 20000);

        const testPath = path.join(__dirname, "L0UseMSbuild15OnMac.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        assert(testRunner.ran("/home/bin/msbuild /user/build/fun/test.csproj /t:PackageForAndroid"),
            "msbuild should have run");
        assert(testRunner.stderr.length == 0, "should not have written to stderr");
        assert(testRunner.succeeded, "task should have succeeded");

        done();
    });

    it("run XamarinAndroid with no matching projects", (done: Mocha.Done) => {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT || "") || 20000);

        const testPath = path.join(__dirname, "L0NoMatchingProjects.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        assert(testRunner.failed, "task should have failed");
        assert(testRunner.createdErrorIssue("loc_mock_NoMatchingProjects **/home*.csproj"), "task did not throw expected error, errors thrown: " + testRunner.errorIssues);
        assert(testRunner.invokedToolCount == 0, "task should not have run XamarinAndroid");

        done();
    });

    it("run XamarinAndroid with single project file", (done: Mocha.Done) => {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT || "") || 20000);

        const testPath = path.join(__dirname, "L0SingleProjectFile.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        assert(testRunner.ran("/home/bin/xbuild /user/build/fun/project.csproj /t:PackageForAndroid"), "it should have run xamarin android");
        assert(testRunner.invokedToolCount == 1, "should have only run XamarinAndroid 1 time");
        assert(testRunner.stderr.length == 0, "should not have written to stderr");
        assert(testRunner.succeeded, "task should have succeeded");

        done();
    });

    it("run XamarinAndroid where project matches multiple files", (done: Mocha.Done) => {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT || "") || 20000);

        const testPath = path.join(__dirname, "L0MultipleProjectFiles.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        assert(testRunner.ran("/home/bin/xbuild /user/build/fun/project1.csproj /t:PackageForAndroid"), "it should have run xamarin android 1");
        assert(testRunner.ran("/home/bin/xbuild /user/build/fun/project2.csproj /t:PackageForAndroid"), "it should have run xamarin android 2");
        assert(testRunner.ran("/home/bin/xbuild /user/build/fun/project3.csproj /t:PackageForAndroid"), "it should have run xamarin android 3");
        assert(testRunner.invokedToolCount == 3, "should have only run XamarinAndroid 3 times");
        assert(testRunner.stderr.length == 0, "should not have written to stderr");
        assert(testRunner.succeeded, "task should have succeeded");

        done();
    });

    it("run XamarinAndroid with jdkVersion set to 1.8", (done: Mocha.Done) => {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT || "") || 20000);

        const testPath = path.join(__dirname, "L0ValidJdkVersion.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        assert(testRunner.ran("/home/bin/xbuild /user/build/fun/project.csproj /t:PackageForAndroid /p:JavaSdkDirectory=/user/local/bin/Java8"), "it should have run xamarin android");
        assert(testRunner.invokedToolCount == 1, "should have only run XamarinAndroid 1 time");
        assert(testRunner.stderr.length == 0, "should not have written to stderr");
        assert(testRunner.succeeded, "task should have succeeded");

        done();
    });

    it("run XamarinAndroid with jdkVersion set to 1.5", (done: Mocha.Done) => {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT || "") || 20000);

        const testPath = path.join(__dirname, "L0InvalidJdkVersion.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        assert(testRunner.failed, "task should have failed");
        assert(testRunner.createdErrorIssue("Error: Failed to find the specified JDK version"), "task did not throw expected error, errors thrown: " + testRunner.errorIssues);
        assert(testRunner.invokedToolCount == 0, "task should not have run XamarinAndroid");

        done();
    });

    it("run XamarinAndroid with msbuildLocation provided", (done: Mocha.Done) => {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT || "") || 20000);

        const testPath = path.join(__dirname, "L0ValidMsBuildLocation.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        const buildToolLocation = path.join("/home/bin2", "xbuild");
        assert(testRunner.ran(`${buildToolLocation} /user/build/fun/project.csproj /t:PackageForAndroid`), "it should have run xamarin android");
        assert(testRunner.invokedToolCount == 1, "should have only run XamarinAndroid 1 time");
        assert(testRunner.stderr.length == 0, "should not have written to stderr");
        assert(testRunner.succeeded, "task should have succeeded");

        done();
    });

    it("run XamarinAndroid with invalid msbuildLocation provided", (done: Mocha.Done) => {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT || "") || 20000);

        const testPath = path.join(__dirname, "L0InvalidMsBuildLocation.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        const buildToolLocation = path.join("/home/bin/INVALID", "xbuild");
        assert(testRunner.failed, "task should have failed");
        assert(testRunner.createdErrorIssue(`Error: Not found ${buildToolLocation}`), "task did not throw expected error, errors thrown: " + testRunner.errorIssues);
        assert(testRunner.invokedToolCount == 0, "task should not have run XamarinAndroid");

        done();
    });

    it("run XamarinAndroid without create app package", (done: Mocha.Done) => {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT || "") || 20000);

        const testPath = path.join(__dirname, "L0NoCreateAppPackage.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        assert(testRunner.ran("/home/bin/xbuild /user/build/fun/project.csproj"), "it should have run xamarin android");
        assert(testRunner.invokedToolCount == 1, "should have only run XamarinAndroid 1 time");
        assert(testRunner.stderr.length == 0, "should not have written to stderr");
        assert(testRunner.succeeded, "task should have succeeded");

        done();
    });

    it("run XamarinAndroid with all arguments provided", (done: Mocha.Done) => {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT || "") || 20000);

        const testPath = path.join(__dirname, "L0AllArguments.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        assert(testRunner.ran(`/home/bin/xbuild /user/build/fun/project.csproj /t:Clean /t:"My Target" /t:PackageForAndroid /m:1 /p:temp=/home/temp dir/ /f /p:OutputPath="/home/o u t/dir" /p:Configuration="For Release" /p:JavaSdkDirectory=/user/local/bin/Java8`), "it should have run xamarin android");
        assert(testRunner.invokedToolCount == 1, "should have only run XamarinAndroid 1 time");
        assert(testRunner.stderr.length == 0, "should not have written to stderr");
        assert(testRunner.succeeded, "task should have succeeded");

        done();
    });
})