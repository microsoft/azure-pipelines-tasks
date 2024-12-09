import * as path from "path";

import { TaskLibAnswers } from "azure-pipelines-task-lib/mock-answer";
import { TaskMockRunner } from "azure-pipelines-task-lib/mock-run";

import { getTempDir, initializeTest, MavenTaskInputs, setInputs } from "./TestUtils";

const taskPath = path.join(__dirname, "..", "maventask.js");

const taskRunner = new TaskMockRunner(taskPath);

// Common initial setup
initializeTest(taskRunner);

// Set Inputs
const inputs: MavenTaskInputs = {
    mavenVersionSelection: "Default",
    mavenPOMFile: "pom.xml",
    options: "",
    goals: "package",
    javaHomeSelection: "JDKVersion",
    jdkVersion: "default",
    publishJUnitResults: true,
    testResultsFiles: "**/TEST-*.xml",
    mavenFeedAuthenticate: false,
    skipEffectivePom: true
};
setInputs(taskRunner, inputs);

// Set up environment variables (task-lib does not support mocking getVariable)
// Env vars in the mock framework must replace '.' with '_'
delete process.env['M2_HOME'] // Remove in case process running this test has it already set

// Provide answers for task mock
const answers: TaskLibAnswers = {
    which: {
        mvn: "/home/bin/maven/bin/mvn"
    },
    checkPath: {
        "/home/bin/maven/bin/mvn": true,
        "pom.xml": true
    },
    exec: {
        "/home/bin/maven/bin/mvn -version": {
            code: 0,
            stdout: "Maven version 1.0.0"
        },
        "/home/bin/maven/bin/mvn -f pom.xml package": {
            code: 0,
            stdout: "Maven package done"
        },
    },
    findMatch: {
        "**/TEST-*.xml": [
            "/user/build/fun/test-123.xml"
        ]
    },
    exist: {
        [path.join(getTempDir(), ".mavenInfo")] : true
    }
};
taskRunner.setAnswers(answers);

// Run task
taskRunner.run();
