import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'dotnetcore.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tmr.setInput('command', "publish");
tmr.setInput('projects', process.env["__projects__"]);
tmr.setInput('publishWebProjects', process.env["__publishWebProjects__"] && process.env["__publishWebProjects__"] == "true" ? "true" : "false");
tmr.setInput('arguments', process.env["__arguments__"] ? process.env["__arguments__"] : "");
tmr.setInput('modifyOutputPath', process.env["modifyOutput"] == "false" ? "false" : "true");

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": { "dotnet": "dotnet" },
    "checkPath": { "dotnet": true },
    "exist": {
        "web/web.config": true,
        "web2/wwwroot": true,
    },
    "exec": {
        "dotnet publish web/project.json": {
            "code": 0,
            "stdout": "published",
            "stderr": ""
        },
        "dotnet publish web/project.csproj": {
            "code": 0,
            "stdout": "published",
            "stderr": ""
        },
        "dotnet publish web2/project.json": {
            "code": 0,
            "stdout": "published",
            "stderr": ""
        },
        "dotnet publish web.tests/project.json": {
            "code": 0,
            "stdout": "published",
            "stderr": ""
        },
        "dotnet publish lib/project.json": {
            "code": 0,
            "stdout": "published",
            "stderr": ""
        },
        "dotnet publish web3/project.json --configuration release --output /usr/out/web3": {
            "code": 0,
            "stdout": "published",
            "stderr": ""
        },
        "dotnet publish lib2/project.json --configuration release --output /usr/out/lib2": {
            "code": 0,
            "stdout": "published",
            "stderr": ""
        },
         "dotnet publish web3/project.json --configuration release --output /usr/out": {
            "code": 0,
            "stdout": "published web3 without adding project name to path\n",
            "stderr": ""
        },
        "dotnet publish lib2/project.json --configuration release --output /usr/out": {
            "code": 0,
            "stdout": "published lib2 without adding project name to path\n",
            "stderr": ""
        },
        "dotnet publish --configuration release --output /usr/out": {
            "code": 0,
            "stdout": "published without adding project name to path\n",
            "stderr": ""
        },
        "dotnet publish": {
            "code": 0,
            "stdout": "published",
            "stderr": ""
        },
        "dotnet publish web/project.csproj --configuration release --output /usr/out/web": {
            "code": 0,
            "stdout": "published",
            "stderr": ""
        },
        "dotnet publish lib/project.csproj --configuration release --output /usr/out": {
            "code": 0,
            "stdout": "published",
            "stderr": ""
        },
        "dotnet publish dummy/project.json": {
            "code": 1,
            "stdout": "not published",
            "stderr": ""
        }
    },
    "findMatch": {
        "**/project.json": ["web/project.json", "web2/project.json", "web.tests/project.json", "lib/project.json"],
        "**/project.json;**/*.csproj": ["web/project.json", "web2/project.json", "web.tests/project.json", "lib/project.json"],
        "**/project.json;**/*.csproj;**/*.vbproj": ["web/project.json", "web2/project.json", "web.tests/project.json", "lib/project.json"],
        "**/*.csproj\n**/*.vbproj\n**/*.fsproj": ["web/project.csproj"],
        "*fail*/project.json": [],
        "*customoutput/project.json": ["web3/project.json", "lib2/project.json"],
        "dummy/project.json": ["dummy/project.json"],
        "" : []
    }
};

process.env["MOCK_NORMALIZE_SLASHES"] = "true";
tmr.setAnswers(a);
tmr.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));

tmr.run();