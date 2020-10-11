import { TaskLibAnswers } from "azure-pipelines-task-lib/mock-answer";
import { TaskMockRunner } from "azure-pipelines-task-lib/mock-run";
import path = require("path");

let taskPath = path.join(__dirname, "..", "xamarinandroid.js");
const taskRunner: TaskMockRunner = new TaskMockRunner(taskPath);

taskRunner.setInput("project", "**/Single*.csproj");
taskRunner.setInput("target", `"My Target"`);
taskRunner.setInput("clean", "true");
taskRunner.setInput("createAppPackage", "true");
taskRunner.setInput("outputDir", `"/home/o u t/dir"`);
taskRunner.setInput("configuration", `"For Release"`);
taskRunner.setInput("msbuildLocation", "");
taskRunner.setInput("msbuildArguments", `/m:1 "/p:temp=/home/temp dir/" /f`);
taskRunner.setInput("javaHomeSelection", "JDKVersion");
taskRunner.setInput("jdkVersion", "1.8");
taskRunner.setInput("jdkArchitecture", "x86");

// provide answers for task mock
process.env["HOME"] = "/user/home"; //replace with mock of getVariable when task-lib has the support

const answers: TaskLibAnswers = {
    which: {
        "xbuild": "/home/bin/xbuild"
    },
    exec: {
        [`/home/bin/xbuild /user/build/fun/project.csproj /t:Clean /t:"My Target" /t:PackageForAndroid /m:1 /p:temp=/home/temp dir/ /f /p:OutputPath="/home/o u t/dir" /p:Configuration="For Release" /p:JavaSdkDirectory=/user/local/bin/Java8`]: {
            "code": 0,
            "stdout": "Xamarin android"
        },
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
            return "/user/local/bin/Java8";
        },
        publishJavaTelemetry: function (taskName: string, javaTelemetryData: any) { }
    }
);

taskRunner.run();
