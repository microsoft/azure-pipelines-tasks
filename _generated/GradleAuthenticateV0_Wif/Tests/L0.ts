import fs = require("fs");
import assert = require("assert");
import path = require("path");
import * as tl from "azure-pipelines-task-lib/task";
import * as ttm from "azure-pipelines-task-lib/mock-test";

const testUserHomeDir = path.join(__dirname, "USER_HOME");
const gradleDirName = ".gradle"
const gradleDirPath = path.join(testUserHomeDir, gradleDirName);
const gradlePropertiesName = "gradle.properties";
const gradlePropertiesPath = path.join(gradleDirPath, gradlePropertiesName);
const gradlePropertiesOtherFeedName = path.join(__dirname, "Samples", "gradlePropertiesOtherFeedName.properties");
const gradlePropertiesFeedName1 = path.join(__dirname, "Samples", "gradlePropertiesFeedName1.properties");

const usernameRegex = /Username=/mig;
const passwordRegex = /Password=/mig;

describe("authenticate azure artifacts feeds for gradle", function() {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);
    var env;

    this.beforeAll(async () => {
        env = Object.assign({}, process.env);
        process.env["USERPROFILE"] = testUserHomeDir;
        process.env["HOME"] = testUserHomeDir;
    });

    beforeEach(async () => {
        tl.mkdirP(gradleDirPath);
    })

    this.afterAll(async () => {
        process.env = env;
    })

    afterEach(async () => {
        tl.rmRF(gradleDirPath);
    });

    it("it should create a new gradle.properties in the .gradle folder and add auth for 1 feed.", async () => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, "L0AuthGradleProperties.js");

        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert.equal(tl.ls(null, [gradleDirPath]).length, 1, "Should have one file.");
        const gradlePropertiesStats = tl.stats(gradlePropertiesPath);
        assert(gradlePropertiesStats && gradlePropertiesStats.isFile(), "gradle.properties file should be created.");

        const data = fs.readFileSync(gradlePropertiesPath, 'utf-8');

        assert.equal(data.match(usernameRegex).length, 1, "Only one username entry should be created.");
        assert.equal(data.match(passwordRegex).length, 1, "Only one password entry should be created.");
        assert(data.includes("feedName1Username="), "feedName1Username entry should be present.");
        assert(data.includes("feedName1Password="), "feedName1Password entry should be present.");

        assert(tr.stderr.length === 0, "should not have written to stderr");
        assert(tr.succeeded, "task should have succeeded");
    });

    it("it should read the existing gradle.properties and add auth for 1 new feed", async () => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, "L0AuthGradlePropertiesExists.js");

        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tl.cp(gradlePropertiesOtherFeedName, gradlePropertiesPath);

        await tr.runAsync();

        assert.equal(tl.ls(null, [gradleDirPath]).length, 1, "Should have one file.");
        const gradlePropertiesStats = tl.stats(gradlePropertiesPath);
        assert(gradlePropertiesStats && gradlePropertiesStats.isFile(), "gradle.properties file should be present.");

        const data = fs.readFileSync(gradlePropertiesPath, 'utf-8');

        assert.equal(data.match(usernameRegex).length, 2, "2 username entries should be present.");
        assert.equal(data.match(passwordRegex).length, 2, "2 password entries should be present.");
        assert(data.includes("feedName1Username="), "feedName1Username entry should be present.");
        assert(data.includes("otherFeedNameUsername="), "otherFeedNameUsername entry should not be deleted.");

        assert(tr.stderr.length === 0, "should not have written to stderr");
        assert(tr.succeeded, "task should have succeeded");
    });

    it("it should read the existing gradle.properties and not add any new entries.", async () => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, "L0AuthGradlePropertiesExists.js");

        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tl.cp(gradlePropertiesFeedName1, gradlePropertiesPath);

        await tr.runAsync();

        assert.equal(tl.ls(null, [gradleDirPath]).length, 1, "Should have one file.");
        const gradlePropertiesStats = tl.stats(gradlePropertiesPath);
        assert(gradlePropertiesStats && gradlePropertiesStats.isFile(), "gradle.properties file should be present.");

        const data = fs.readFileSync(gradlePropertiesPath, 'utf-8');

        assert.equal(data.match(usernameRegex).length, 1, "Only one username entry should be present.");
        assert.equal(data.match(passwordRegex).length, 1, "Only one password entry should be present.");

        assert(tr.stderr.length === 0, "should not have written to stderr");
        assert(tr.stdOutContained("vso[task.issue type=warning;source=TaskInternal;]loc_mock_Warning_FeedEntryAlreadyExists"), "Entry already exists warning should be displayed");
        assert(tr.succeeded, "task should have succeeded");
    });

    it("it should create a new gradle.properties in the .gradle folder and add auth for 2 different types of service connections.", async () => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, "L0ServiceConnections.js");

        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert.equal(tl.ls(null, [gradleDirPath]).length, 1, "Should have one file.");
        const gradlePropertiesStats = tl.stats(gradlePropertiesPath);
        assert(gradlePropertiesStats && gradlePropertiesStats.isFile(), "gradle.properties file should be created.");

        const data = fs.readFileSync(gradlePropertiesPath, 'utf-8');

        assert.equal(data.match(usernameRegex).length, 2, "2 username entries should be created.");
        assert.equal(data.match(passwordRegex).length, 2, "2 password entries should be created.");

        assert(data.includes("tokenBasedUsername=AzureDevOps"), "tokenBased username should be AzureDevOps.");
        assert(data.includes("tokenBasedPassword=--token--"), "tokenBased password should be the token.");

        assert(data.includes("usernamePasswordBasedUsername=--testUserName--"), "usernamePasswordBased username should be set.");
        assert(data.includes("usernamePasswordBasedPassword=--testPassword--"), "usernamePasswordBased password should be set.");

        assert(tr.stderr.length === 0, "should not have written to stderr");
        assert(tr.succeeded, "task should have succeeded");
    });

    it("it should warn if no inputs are provided.", async () => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, "L0EmptyInput.js");

        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        assert.equal(tl.ls(null, [gradleDirPath]).length, 0, "gradle.properties file should not be created.");

        assert(tr.stderr.length === 0, "should not have written to stderr");
        assert(tr.succeeded, "task should have succeeded");
        assert(tr.stdOutContained("vso[task.issue type=warning;source=TaskInternal;]loc_mock_Warning_NoEndpointsToAuth"), "The no endpoints warning should be displayed");
    });
});
