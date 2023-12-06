import { TaskLibAnswers } from "azure-pipelines-task-lib/mock-answer";
import { TaskMockRunner } from "azure-pipelines-task-lib/mock-run";
import path = require("path");

let taskPath = path.join(__dirname, "..", "xamarinandroid.js");
const taskRunner: TaskMockRunner = new TaskMockRunner(taskPath);

taskRunner.setInput("project", "**/Single*.csproj");
taskRunner.setInput("target", "");
taskRunner.setInput("clean", "false");
taskRunner.setInput("createAppPackage", "true");
taskRunner.setInput("outputDir", "");
taskRunner.setInput("configuration", "");
taskRunner.setInput("msbuildLocation", "");
taskRunner.setInput("msbuildArguments", "");
taskRunner.setInput("javaHomeSelection", "JDKVersion");
taskRunner.setInput("jdkVersion", "1.8");
taskRunner.setInput("jdkArchitecture", "x86");

// provide answers for task mock
process.env["HOME"] = "/user/home"; //replace with mock of getVariable when task-lib has the support

const answers: TaskLibAnswers = {
    which: {
        "xbuild": "/home/bin/xbuild"
    },
    findMatch: {
        "**/Single*.csproj": [
            "/user/build/fun/project.csproj"
        ]
    }
};
taskRunner.setAnswers(answers);

taskRunner.registerMock("azure-pipelines-tasks-java-common/java-common",
    {
        findJavaHome: function (jdkVersion: string, jdkArch: string): string {
            throw new Error("Failed to find the specified JDK version");
        },
        publishJavaTelemetry: function (taskName: string, javaTelemetryData: any) { }
    }
);

taskRunner.run();
