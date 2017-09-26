import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
const util = require('util')

var os = require('os');
var homedir = os.homedir();
let pypircFilePath: string = path.join(homedir, ".pypirc").replace(/\\/g, "\\\\");

let publisher = path.join(__dirname, '..', 'publisher.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(publisher);
tmr.setInput('serviceEndpoint', 'MyTestEndpoint');
tmr.setInput('wd', 'wd');

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "python": "python"
    },
    "checkPath": {
        "python": true
    },
    "exec" : {
        "python -m pip install wheel twine --user" : {
            "code": 0,
            "stdout": "twine installed successfully",
            "stderr": ""
        },
        "python wd\\setup.py sdist --dist-dir wd\\dist bdist_wheel" : {
            "code": 0,
            "stdout": "distribution files created successfully",
            "stderr": ""
        },
        "python -m twine upload wd\\dist/*" : {
            "code": 0,
            "stdout": "distribution files uploaded successfully",
            "stderr": ""
        },
        "python wd/setup.py sdist --dist-dir wd/dist bdist_wheel" : {
            "code": 0,
            "stdout": "distribution files created successfully",
            "stderr": ""
        },
        "python -m twine upload wd/dist/*" : {
            "code": 0,
            "stdout": "distribution files uploaded successfully",
            "stderr": ""
        }
    },
    "rmRF" : {
        [pypircFilePath]:{
         "success":true
      }
    }
};
tmr.setAnswers(a);
//console.log((util.inspect(tmr._answers, {showHidden: false, depth: null})));
tmr.run();
