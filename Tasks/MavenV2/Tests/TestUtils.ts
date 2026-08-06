import * as fs from "fs";
import * as path from "path";

import { TaskMockRunner } from "azure-pipelines-task-lib/mock-run";
import { TaskLibAnswers } from "azure-pipelines-task-lib/mock-answer";

import { registerLocationHelpersMock } from 'azure-pipelines-tasks-packaging-common/Tests/MockHelper';

export interface MavenTaskInputs {
    mavenVersionSelection?: string;
    mavenPath?: string;
    mavenPOMFile?: string;
    mavenSetM2Home?: string;
    options?: string;
    goals?: string;
    javaHomeSelection?: string;
    jdkVersion?: string;
    publishJUnitResults?: boolean;
    testResultsFiles?: string;
    mavenOpts?: string;
    checkstyleAnalysisEnabled?: boolean;
    pmdAnalysisEnabled?: boolean;
    findbugsAnalysisEnabled?: boolean;
    spotBugsAnalysisEnabled?: boolean;
    spotBugsGoal?: string;
    spotBugsMavenPluginVersion?: string;
    mavenFeedAuthenticate?: boolean;
    skipEffectivePom?: boolean;
    codeCoverageTool?: string;
    restoreOriginalPomXml?: boolean;
}

export const setInputs = (
    taskRunner: TaskMockRunner,
    inputs: MavenTaskInputs
) => {
    for (const key in inputs) {
        const value = inputs[key];
        if (value || typeof value === "boolean") { // We still want false to show up as input
            taskRunner.setInput(key, String(value));
        }
    }
};

const deleteFolderRecursive = (path): void => {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function (file, index) {
            let curPath: string = path + '/' + file;
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
}

export const getTempDir = (): string => {
    return path.join(__dirname, '_temp');
};

export function cleanTemporaryFolders(): void {
    deleteFolderRecursive(getTempDir());
}

export function createTemporaryFolders(): void {
    let testTempDir = getTempDir();
    let sqTempDir: string = path.join(testTempDir, '.sqAnalysis');

    if (!fs.existsSync(testTempDir)) {
        fs.mkdirSync(testTempDir);
    }

    if (!fs.existsSync(sqTempDir)) {
        fs.mkdirSync(sqTempDir);
    }
}

export const initializeTest = (taskRunner: TaskMockRunner): void => {
    process.env["SYSTEM_TEAMFOUNDATIONCOLLECTIONURI"] = "https://xplatalm.visualstudio.com/";

    const tempDirectory = getTempDir();
    process.env["AGENT_TEMPDIRECTORY"] = tempDirectory;
    process.env['BUILD_SOURCESDIRECTORY'] = '/user/build';
    process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = "/user/build";

    process.env['HOME'] = '/users/test'; //replace with mock of setVariable when task-lib has the support

    // Set up mocks for common packages
    registerLocationHelpersMock(taskRunner);

    // Prevent file writes
    taskRunner.registerMockExport("writefile", (file: string, data: string | Buffer, options?: string | fs.WriteFileOptions): void => {})
    taskRunner.registerMockExport("cp", (source: string, dest: string, options?: string, continueOnError?: boolean): void => {})
}

export const runMavenFeedHostTest = (): void => {
    const repoUrl = process.env["MAVEN_TEST_REPO_URL"];

    const taskPath = path.join(__dirname, "..", "maventask.js");
    const taskRunner = new TaskMockRunner(taskPath);

    initializeTest(taskRunner);

    const inputs: MavenTaskInputs = {
        mavenVersionSelection: "Default",
        mavenPOMFile: "pom.xml",
        options: "",
        goals: "package",
        javaHomeSelection: "JDKVersion",
        jdkVersion: "default",
        publishJUnitResults: true,
        testResultsFiles: "**/TEST-*.xml",
        mavenOpts: "-Xmx2048m",
        checkstyleAnalysisEnabled: false,
        pmdAnalysisEnabled: false,
        findbugsAnalysisEnabled: false,
        mavenFeedAuthenticate: true
    };
    setInputs(taskRunner, inputs);

    delete process.env["M2_HOME"];

    const settingsPath = path.join(getTempDir(), "settings.xml");

    const effectivePom =
        "Effective POMs, after inheritance, interpolation, and profiles are applied:\r\n" +
        "\r\n" +
        "<!-- Effective POM for project 'com.microsoft.xplatalm:xplatalmApp:jar:1.0-SNAPSHOT' -->\r\n" +
        "\r\n" +
        "<project xmlns=\"http://maven.apache.org/POM/4.0.0\">\r\n" +
        "  <modelVersion>4.0.0</modelVersion>\r\n" +
        "  <groupId>com.microsoft.xplatalm</groupId>\r\n" +
        "  <artifactId>xplatalmApp</artifactId>\r\n" +
        "  <version>1.0-SNAPSHOT</version>\r\n" +
        "  <repositories>\r\n" +
        "    <repository>\r\n" +
        "      <id>testFeed</id>\r\n" +
        "      <url>" + repoUrl + "</url>\r\n" +
        "    </repository>\r\n" +
        "  </repositories>\r\n" +
        "</project>\r\n";

    const answers: TaskLibAnswers = {
        which: { mvn: "/home/bin/maven/bin/mvn" },
        checkPath: {
            "/home/bin/maven/bin/mvn": true,
            "pom.xml": true
        },
        exec: {
            "/home/bin/maven/bin/mvn -version": { code: 0, stdout: "Maven version 1.0.0" },
            "/home/bin/maven/bin/mvn -f pom.xml help:effective-pom": { code: 0, stdout: effectivePom },
            [`/home/bin/maven/bin/mvn -f pom.xml -s ${settingsPath} package`]: { code: 0, stdout: "Maven package done" },
            "/home/bin/maven/bin/mvn -f pom.xml package": { code: 0, stdout: "Maven package done" }
        },
        findMatch: { "**/TEST-*.xml": ["/user/build/fun/test-123.xml"] },
        exist: { [path.join(getTempDir(), ".mavenInfo")]: true }
    };
    taskRunner.setAnswers(answers);

    taskRunner.run();
};