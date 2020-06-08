import { TaskLibAnswers } from 'azure-pipelines-task-lib/mock-answer';
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';
import path = require('path');

let taskPath = path.join(__dirname, '..', 'xamarinandroid.js');
const taskRunner: TaskMockRunner = new TaskMockRunner(taskPath);

taskRunner.setInput('project', '**/test*.csproj');
taskRunner.setInput('target', '');
taskRunner.setInput('clean', 'false');
taskRunner.setInput('createAppPackage', 'true');
taskRunner.setInput('outputDir', '');
taskRunner.setInput('configuration', '');
taskRunner.setInput('msbuildLocationMethod', 'version');
taskRunner.setInput("msbuildVersion", "15.0");
taskRunner.setInput('msbuildLocation', '');
taskRunner.setInput('msbuildArguments', '');
taskRunner.setInput('javaHomeSelection', 'JDKVersion');
taskRunner.setInput('jdkVersion', 'default');

// provide answers for task mock
process.env['HOME'] = '/user/home'; //replace with mock of getVariable when task-lib has the support

const answers: TaskLibAnswers = {
    which: {
        "msbuild": "/home/bin/msbuild"
    },
    exec: {
        "/home/bin/msbuild /version /nologo": {
            "code": 0,
            "stdout": "15.1.0.0"
        },
        "/home/bin/msbuild /user/build/fun/test.csproj /t:PackageForAndroid": {
            "code": 0,
            "stdout": "Xamarin android project"
        }
    },
    findMatch: {
        "**/test*.csproj": [
            "/user/build/fun/test.csproj"
        ]
    }
};
taskRunner.setAnswers(answers);

taskRunner.run();
