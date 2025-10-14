import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');
import util = require('./DotnetMockHelper');

let taskPath = path.join(__dirname, '..', 'dotnetcore.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
let nmh: util.DotnetMockHelper = new util.DotnetMockHelper(tmr);

tmr.setInput('command', process.env["__command__"]);
tmr.setInput('projects', process.env["__projects__"]);

// Get out of the Tests folder to the task root folder. This will match the path used in the task.
// We normalize the string to use forward slashes as that is what the mock answer does and makes this test cross platform.
var loggerAssembly = path.join(__dirname, '..', 'dotnet-build-helpers/Microsoft.TeamFoundation.DistributedTask.MSBuild.Logger.dll').replace(/\\/g, "/");
var loggerString = `-dl:CentralLogger,"${loggerAssembly}"*ForwardingLogger,"${loggerAssembly}"`

let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": { "dotnet": "dotnet" },
    "checkPath": { "dotnet": true },
    "exec": {
        "dotnet restore web/project.json": {
            "code": 0,
            "stdout": "restored",
            "stderr": ""
        },
        "dotnet restore web2/project.json": {
            "code": 0,
            "stdout": "restored",
            "stderr": ""
        },
        "dotnet restore web.tests/project.json": {
            "code": 0,
            "stdout": "restored",
            "stderr": ""
        },
        "dotnet restore lib/project.json": {
            "code": 0,
            "stdout": "restored",
            "stderr": ""
        },
        "dotnet restore": {
            "code": 0,
            "stdout": "restored",
            "stderr": ""
        },
        "dotnet restore dummy/project.json": {
            "code": 1,
            "stdout": "not restored",
            "stderr": ""
        }
    },
    "findMatch": {
        "**/project.json": ["web/project.json", "web2/project.json", "web.tests/project.json", "lib/project.json"],
        "**/project.json;**/*.csproj" :["web/project.json", "web2/project.json", "web.tests/project.json", "lib/project.json"],
        "**/project.json;**/*.csproj;**/*.vbproj" : ["web/project.json", "web2/project.json", "web.tests/project.json", "lib/project.json"],
        "*fail*/project.json": [],
        "*customoutput/project.json": ["web3/project.json", "lib2/project.json"],
        "dummy/project.json" : ["dummy/project.json"],
        "" : []
    }
};

a["exec"][`dotnet build ${loggerString}`] = {
    "code": 0,
    "stdout": "built",
    "stderr": ""
};

process.env["MOCK_NORMALIZE_SLASHES"] = "true";
tmr.setAnswers(a);
tmr.registerMock('azure-pipelines-task-lib/toolrunner', require('azure-pipelines-task-lib/mock-toolrunner'));

tmr.run();