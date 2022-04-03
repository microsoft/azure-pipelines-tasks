import * as assert from "assert";
import * as path from "path";

import { MockTestRunner } from "azure-pipelines-task-lib/mock-test";

import { cleanTemporaryFolders, createTemporaryFolders, getTempDir } from "./TestUtils";

describe("Maven L0 Suite", function () {
    before(() => {
        // Set up mock authorization
        process.env["ENDPOINT_AUTH_SYSTEMVSSCONNECTION"] = "{\"parameters\":{\"AccessToken\":\"token\"},\"scheme\":\"OAuth\"}";
        process.env["ENDPOINT_URL_SYSTEMVSSCONNECTION"] = "https://example.visualstudio.com/defaultcollection";

        // Mock temp paths
        // process.env["MOCK_IGNORE_TEMP_PATH"] = "true"; // This will remove the temp path from any outputs
        process.env["MOCK_TEMP_PATH"] = path.join(__dirname, "..", "..");
        process.env["MOCK_NORMALIZE_SLASHES"] = "true";

        createTemporaryFolders();
    });

    after(() => {
        cleanTemporaryFolders();
    });

    it("run maven with all default inputs and M2_HOME not set", function (done) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
        const testPath = path.join(__dirname, "L0DefaultsWithNoHomeSet.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        assert(testRunner.ran("/home/bin/maven/bin/mvn -version"), "it should have run mvn -version");
        assert(testRunner.ran("/home/bin/maven/bin/mvn -f pom.xml help:effective-pom"), "it should have generated effective pom");
        assert(testRunner.ran("/home/bin/maven/bin/mvn -f pom.xml package"), "it should have run mvn -f pom.xml package");
        assert(testRunner.invokedToolCount == 3, "should have only run maven 3 times: " + testRunner.invokedToolCount);
        assert(testRunner.stderr.length == 0, "should not have written to stderr=" + testRunner.stderr);
        assert(testRunner.succeeded, "task should have succeeded");
        assert(testRunner.stdOutContained("MAVEN_OPTS is now set to -Xmx2048m"), "it should have set MAVEN_OPTS");

        assert(!testRunner.stdOutContained("##vso[artifact.upload artifactname=Code Analysis Results;]"),
            "should not have uploaded a Code Analysis Report build summary");

        done();
    });

    it("run maven with all default inputs and M2_HOME set", function (done) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
        const testPath = path.join(__dirname, "L0DefaultsWithHomeSet.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        const mavenHome = "/anotherHome/";
        const mavenBin = path.join(mavenHome, "bin", "mvn");
        assert(testRunner.ran(`${mavenBin} -version`), "it should have run mvn -version");
        assert(testRunner.ran(`${mavenBin} -f pom.xml help:effective-pom`), "it should have generated effective pom");
        assert(testRunner.ran(`${mavenBin} -f pom.xml package`), "it should have run mvn -f pom.xml package");
        assert(testRunner.invokedToolCount == 3, "should have only run maven 3 times: " + testRunner.invokedToolCount);
        assert(testRunner.stderr.length == 0, "should not have written to stderr=" + testRunner.stderr);
        assert(testRunner.succeeded, "task should have succeeded");

        done();
    });

    it("run maven with missing mavenVersionSelection", function (done) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
        const testPath = path.join(__dirname, "L0MissingMavenVersionSelection.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        assert(testRunner.invokedToolCount == 0, "should not have run maven");
        assert(testRunner.failed, "task should have failed");
        assert(testRunner.createdErrorIssue("Unhandled: Input required: mavenVersionSelection"), "Did not create expected error issue, issues created: " + testRunner.errorIssues);

        done();
    });

    it("run maven with missing mavenFeedAuthenticate", function (done) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
        const testPath = path.join(__dirname, "L0MissingMavenFeedAuthenticate.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        assert(testRunner.invokedToolCount == 0, "should not have run maven");
        assert(testRunner.failed, "task should have failed");
        assert(testRunner.createdErrorIssue("Unhandled: Input required: mavenFeedAuthenticate"), "Did not create expected error issue, issues created: " + testRunner.errorIssues);

        done();
    });

    it("run maven with invalid mavenVersionSelection", function (done) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
        const testPath = path.join(__dirname, "L0InvalidMavenVersionSelection.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        assert(testRunner.ran("/home/bin/maven/bin/mvn -version"), "it should have run mvn -version");
        assert(testRunner.ran("/home/bin/maven/bin/mvn -f pom.xml help:effective-pom"), "it should have generated effective pom");
        assert(testRunner.ran("/home/bin/maven/bin/mvn -f pom.xml package"), "it should have run mvn -f pom.xml package");
        assert(testRunner.invokedToolCount == 3, "should have only run maven 3 times: " + testRunner.invokedToolCount);
        assert(testRunner.stderr.length == 0, "should not have written to stderr=" + testRunner.stderr);
        assert(testRunner.succeeded, "task should have succeeded");

        done();
    });

    it("run maven with mavenVersionSelection set to Path (mavenPath valid)", function (done) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
        const testPath = path.join(__dirname, "L0MavenVersionSelectionSetToPath.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        const mavenHome = "/home/bin/maven2/";
        const mavenBin = path.join(mavenHome, "bin", "mvn");
        assert(testRunner.ran(`${mavenBin} -version`), "it should have run mvn -version");
        assert(testRunner.ran(`${mavenBin} -f pom.xml help:effective-pom`), "it should have generated effective pom");
        assert(testRunner.ran(`${mavenBin} -f pom.xml package`), "it should have run mvn -f pom.xml package");
        assert(testRunner.invokedToolCount == 3, "should have only run maven 3 times: " + testRunner.invokedToolCount);
        assert(testRunner.stderr.length == 0, "should not have written to stderr=" + testRunner.stderr);
        assert(testRunner.succeeded, "task should have succeeded");

        done();
    });

    it("run maven with mavenVersionSelection set to Path (mavenPath missing)", function (done) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
        const testPath = path.join(__dirname, "L0MavenPathMissing.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        assert(testRunner.invokedToolCount == 0, "should not have run maven");
        assert(testRunner.failed, "task should have failed");
        assert(testRunner.createdErrorIssue("Unhandled: Input required: mavenPath"), "Did not create expected error issue, issues created: " + testRunner.errorIssues);

        done();
    });

    it("run maven with mavenVersionSelection set to Path (mavenPath invalid)", function (done) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
        const testPath = path.join(__dirname, "L0MavenPathInvalid.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        assert(testRunner.invokedToolCount == 0, "should not have run maven");
        assert(testRunner.failed, "task should have failed");
        assert(testRunner.createdErrorIssue("Unhandled: Not found /not/a/valid/maven/path/"), "Did not create expected error issue, issues created: " + testRunner.errorIssues);

        done();
    });

    it("run maven with mavenSetM2Home invalid", function (done) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
        const testPath = path.join(__dirname, "L0SetM2HomeInvalid.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        const mavenHome = "/home/bin/maven2/";
        const mavenBin = path.join(mavenHome, "bin", "mvn");
        assert(testRunner.ran(`${mavenBin} -version`), "it should have run mvn -version");
        assert(testRunner.ran(`${mavenBin} -f pom.xml help:effective-pom`), "it should have generated effective pom");
        assert(testRunner.ran(`${mavenBin} -f pom.xml package`), "it should have run mvn -f pom.xml package");
        assert(testRunner.invokedToolCount == 3, "should have only run maven 3 times: " + testRunner.invokedToolCount);
        assert(testRunner.stderr.length == 0, "should not have written to stderr=" + testRunner.stderr);
        assert(testRunner.succeeded, "task should have succeeded");

        done();
    });

    it("run maven with mavenSetM2Home set to true", function (done) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
        const testPath = path.join(__dirname, "L0SetM2Home.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        const mavenHome = "/home/bin/maven2";
        const mavenBin = path.join(mavenHome, "bin", "mvn");
        assert(testRunner.ran(`${mavenBin} -version`), "it should have run mvn -version");
        assert(testRunner.ran(`${mavenBin} -f pom.xml help:effective-pom`), "it should have generated effective pom");
        assert(testRunner.ran(`${mavenBin} -f pom.xml package`), "it should have run mvn -f pom.xml package");
        assert(testRunner.invokedToolCount == 3, "should have only run maven 3 times: " + testRunner.invokedToolCount);
        assert(testRunner.stderr.length == 0, "should not have written to stderr=" + testRunner.stderr);
        assert(testRunner.stdOutContained(`set M2_HOME=${mavenHome}`), "M2_HOME not set");
        assert(testRunner.succeeded, "task should have succeeded");

        done();
    });

    it("run maven with feed", function (done) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
        const testPath = path.join(__dirname, "L0MavenWithFeed.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        const tempDirectory = getTempDir();
        const settingsPath = path.join(tempDirectory, "settings.xml");
        const mavenInfoPath = path.join(tempDirectory, ".mavenInfo", "MavenInfo-");
        assert(testRunner.ran("/home/bin/maven/bin/mvn -version"), "it should have run mvn -version");
        assert(testRunner.ran("/home/bin/maven/bin/mvn -f pom.xml help:effective-pom"), "it should have generated effective pom");
        assert(testRunner.ran(`/home/bin/maven/bin/mvn -f pom.xml -s ${settingsPath} package`), `it should have run mvn -f pom.xml -s ${settingsPath} package`);
        assert(testRunner.invokedToolCount == 3, "should have only run maven 3 times: " + testRunner.invokedToolCount);
        assert(testRunner.stderr.length == 0, "should not have written to stderr=" + testRunner.stderr);
        assert(testRunner.stdOutContained(`##vso[task.debug][Maven] Uploading build maven info from ${mavenInfoPath}`), `MavenInfo not published at expected location: ${mavenInfoPath}`);
        assert(testRunner.succeeded, "task should have succeeded");

        done();
    });

    it("run maven without authenticated feeds", function (done) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
        const testPath = path.join(__dirname, "L0MavenWithoutFeed.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        assert(testRunner.ran("/home/bin/maven/bin/mvn -version"), "it should have run mvn -version");
        assert(testRunner.ran(`/home/bin/maven/bin/mvn -f pom.xml package`), "it should have run mvn -f pom.xml package");
        assert(testRunner.invokedToolCount == 2, "should have only run maven 2 times: " + testRunner.invokedToolCount);
        assert(testRunner.stderr.length == 0, "should not have written to stderr=" + testRunner.stderr);
        assert(!testRunner.stdOutContained("##vso[task.debug][Maven] Uploading build maven info from"), "should not have uploaded a MavenInfo file");
        assert(testRunner.succeeded, "task should have succeeded");

        done();
    });

    it("run maven without authenticated feeds and skip effectivePom", function (done) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
        const testPath = path.join(__dirname, "L0MavenWithoutFeedSkipEffectivePom.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        assert(testRunner.ran("/home/bin/maven/bin/mvn -version"), "it should have run mvn -version");
        assert(testRunner.ran(`/home/bin/maven/bin/mvn -f pom.xml package`), "it should have run mvn -f pom.xml package");
        assert(testRunner.invokedToolCount == 2, "should have only run maven 2 times: " + testRunner.invokedToolCount);
        assert(testRunner.stderr.length == 0, "should not have written to stderr=" + testRunner.stderr);
        assert(testRunner.succeeded, "task should have succeeded");

        done();
    });

    it("run maven with feed settings and spaces", function (done) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
        const testPath = path.join(__dirname, "L0MavenWithFeedSettingsAndSpaces.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        const settingsPath = path.join(getTempDir(), "settings.xml");
        const options = `-DoptWithEscaping={\"serverUri\": \"http://elasticsearch:9200\",\"username\": \"elastic\", \"password\": \"changeme\", \"connectionTimeout\": 30000}`;

        assert(testRunner.ran("/home/bin/maven/bin/mvn -version"), "it should have run mvn -version");
        assert(testRunner.ran(`/home/bin/maven/bin/mvn -f pom.xml help:effective-pom ${options}`), "it should have generated effective pom");
        assert(testRunner.ran(`/home/bin/maven/bin/mvn -f pom.xml -s ${settingsPath} ${options} package`), `it should have run mvn -f pom.xml -s ${settingsPath} ${options} package`);
        assert(testRunner.invokedToolCount == 3, "should have only run maven 3 times: " + testRunner.invokedToolCount);
        assert(testRunner.stderr.length == 0, "should not have written to stderr=" + testRunner.stderr);
        assert(testRunner.succeeded, "task should have succeeded");

        done();
    });


    it("run maven with feed settings", function (done) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
        const testPath = path.join(__dirname, "L0MavenWithFeedSettings.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        const settingsPath = path.join(getTempDir(), "settings.xml");
        const options = "/o -s settings.xml /p /t";
        const optionsWithoutSettings = "/o /p /t";

        assert(testRunner.ran("/home/bin/maven/bin/mvn -version"), "it should have run mvn -version");
        assert(testRunner.ran(`/home/bin/maven/bin/mvn -f pom.xml help:effective-pom ${options}`), "it should have generated effective pom");
        assert(testRunner.ran(`/home/bin/maven/bin/mvn -f pom.xml -s ${settingsPath} ${optionsWithoutSettings} package`), `it should have run mvn -f pom.xml -s ${settingsPath} ${optionsWithoutSettings} package`);
        assert(testRunner.invokedToolCount == 3, "should have only run maven 3 times: " + testRunner.invokedToolCount);
        assert(testRunner.stderr.length == 0, "should not have written to stderr=" + testRunner.stderr);
        assert(testRunner.succeeded, "task should have succeeded");

        done();
    });

    it("run maven with missing goals", function (done) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
        const testPath = path.join(__dirname, "L0MissingGoals.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        assert(testRunner.invokedToolCount == 0, "should not have run maven");
        assert(testRunner.failed, "task should have failed");
        assert(testRunner.createdErrorIssue("Unhandled: Input required: goals"), "Did not create expected error issue, issues created: " + testRunner.errorIssues);

        done();
    });

    it("run maven and publish tests", function (done) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
        const testPath = path.join(__dirname, "L0PublishJUnitTestResults.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        assert(testRunner.stdOutContained("##vso[results.publish type=JUnit;mergeResults=true;publishRunAttachments=true;resultFiles=/user/build/fun/test-123.xml;]"), "it should have published test results");
        assert(testRunner.stderr.length == 0, "should not have written to stderr=" + testRunner.stderr);
        assert(testRunner.succeeded, "task should have succeeded");

        done();
    });

    it("run maven with missing testResultsFiles", function (done) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
        const testPath = path.join(__dirname, "L0MissingTestResultsFiles.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        assert(testRunner.invokedToolCount == 0, "should not have run maven");
        assert(testRunner.failed, "task should have failed");
        assert(testRunner.createdErrorIssue("Unhandled: Input required: testResultsFiles"), "Did not create expected error issue, issues created: " + testRunner.errorIssues);

        done();
    });

    it("run maven with missing javaHomeSelection", function (done) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
        const testPath = path.join(__dirname, "L0MissingJavaHomeSelection.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        assert(testRunner.invokedToolCount == 0, "should not have run maven");
        assert(testRunner.failed, "task should have failed");
        assert(testRunner.createdErrorIssue("Unhandled: Input required: javaHomeSelection"), "Did not create expected error issue, issues created: " + testRunner.errorIssues);

        done();
    });

    it('run maven with code coverage enabled and restore original pom.xml after', function (done) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
        const testPath = path.join(__dirname, 'L0RestoreOriginalPomXml.js');
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        assert(testRunner.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
        assert(testRunner.ran('/home/bin/maven/bin/mvn -f pom.xml help:effective-pom'), 'it should have generated effective pom');
        assert(testRunner.ran('/home/bin/maven/bin/mvn -f pom.xml clean package'), 'it should have run mvn -f pom.xml package');

        const readOriginalPomXmlLogIndex = testRunner.stdout.indexOf('Reading original pom.xml');
        assert(readOriginalPomXmlLogIndex !== -1, 'should have read original pom.xml');
        const wroteModifiedPomXmlLogIndex = testRunner.stdout.indexOf('Writing modified pom.xml contents');
        assert(wroteModifiedPomXmlLogIndex !== -1, 'should have written modified pom.xml contents');
        const wroteOriginalPomXmlLogIndex = testRunner.stdout.indexOf('Writing original pom.xml contents');
        assert(wroteOriginalPomXmlLogIndex !== -1, 'should have written original pom.xml contents');

        assert(readOriginalPomXmlLogIndex < wroteModifiedPomXmlLogIndex, 'it shouldn\'t have saved pom.xml before writing modified pom.xml contents');
        assert(wroteModifiedPomXmlLogIndex < wroteOriginalPomXmlLogIndex, 'it shouldn\'t have restored original pom.xml before writing modified pom.xml contents');

        assert(testRunner.invokedToolCount === 4, 'should have run maven exactly 4 times: ' + testRunner.invokedToolCount);
        assert(testRunner.stderr.length === 0, 'should not have written to stderr=' + testRunner.stderr);
        assert(testRunner.succeeded, 'task should have succeeded');

        done();
    });

    it('run maven with spotbugs plugin enabled', function (done) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
        const testPath = path.join(__dirname, 'L0SpotbugsPlugin.js');
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        assert(testRunner.stdOutContained('Reading pom.xml file'), 'should read the pom.xml file');
        assert(testRunner.stdOutContained('##vso[task.debug]Converting XML to JSON'), 'should convert XML to JSON');
        assert(testRunner.stdOutContained('##vso[task.debug]Adding spotbugs plugin data'), 'should add the spotbugs plugin data to the pom schema');
        assert(testRunner.stdOutContained('##vso[task.debug]Writing JSON as XML file: pom.xml'), 'should write the JSON as xml file');
        assert(testRunner.stdOutContained('##vso[task.debug]Converting JSON to XML'), 'should convert the JSON to the XML');
        assert(testRunner.stdOutContained('Writing modified pom.xml'), 'should have written modified pom.xml contents');
        assert(testRunner.stderr.length === 0, 'should not have written to stderr=' + testRunner.stderr);
        assert(testRunner.succeeded, 'task should have succeeded');

        done();
    });

    it('run maven with spotbugs plugin enabled with results publishing', function (done) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
        const testPath = path.join(__dirname, 'L0SpotbugsWithResultPublishing.js');
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        assert(testRunner.stdOutContained('Reading pom.xml file'), 'should read the pom.xml file');
        assert(testRunner.stdOutContained('##vso[task.debug]Converting XML to JSON'), 'should convert XML to JSON');
        assert(testRunner.stdOutContained('##vso[task.debug]Adding spotbugs plugin data'), 'should add the spotbugs plugin data to the pom schema');
        assert(testRunner.stdOutContained('##vso[task.debug]Writing JSON as XML file: pom.xml'), 'should write the JSON as xml file');
        assert(testRunner.stdOutContained('##vso[task.debug]Converting JSON to XML'), 'should convert the JSON to the XML');
        assert(testRunner.stdOutContained('Writing modified pom.xml'), 'should have written modified pom.xml contents');
        assert(testRunner.stdOutContained('Publishing the spotbugs analysis results'), 'Should publish the spotbugs alaysis results');
        assert(testRunner.stderr.length === 0, 'should not have written to stderr=' + testRunner.stderr);
        assert(testRunner.succeeded, 'task should have succeeded');

        done();
    });
});
