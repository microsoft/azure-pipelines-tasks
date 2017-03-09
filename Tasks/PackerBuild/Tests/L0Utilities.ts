import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
var mockery = require('mockery');

// provide answers for task mock
let a: any = <any>{
    "which": {
        "packer": "packer"
    },
    "checkPath": {
        "packer": true,
        ".\\DefaultTemplates\\default.windows.template.json": process.env["__source_path_exists__"]=== "true" ? true : false
    },
    "exist": {
        "F:\\somedir\\tempdir\\100": process.env["__dest_path_exists__"] === "true" ? true : false
    }
};

mockery.enable({warnOnUnregistered: false});
var tlm = require('vsts-task-lib/mock-task');
tlm.setAnswers(a);
mockery.registerMock('vsts-task-lib/task', tlm);
var ut = require('../src/utilities.js');

ut.copyFile(".\\DefaultTemplates\\default.windows.template.json", "F:\\somedir\\tempdir\\100");