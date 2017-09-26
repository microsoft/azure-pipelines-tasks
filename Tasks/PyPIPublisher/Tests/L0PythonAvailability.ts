import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let publisher = path.join(__dirname, '..', 'publisher.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(publisher);
tmr.setInput('serviceEndpoint', 'MyTestEndpoint');
tmr.setInput('wd', 'test//wd');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "python": "pythoooooooooooooooooooooooooooooooooooooon"
    },
    "exec" : {
        "python -m pip install wheel twine --user" : {
            "code": 0,
            "stdout": "dotnet output, verbosity Detailed",
            "stderr": ""
        },
        "python test//wd//setup.py sdist --dist-dir test//wd//dist bdist_wheel" : {
            "code": 0,
            "stdout": "dotnet output, verbosity Detailed",
            "stderr": ""
        },
        "python -m twine upload test//wd//dist/*" : {
            "code": 0,
            "stdout": "dotnet output, verbosity Detailed",
            "stderr": ""
        }
    }
};

tmr.setAnswers(a);
tmr.run(); 