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
        ".\\DefaultTemplates\\default.windows.template.json": process.env["__source_path_exists__"] === "false" ? false : true,
        "C:\\deploy.ps1": true
    },
    "exist": {
        "F:\\somedir\\tempdir\\100": process.env["__dest_path_exists__"] === "false" ? false : true
    }
};

mockery.enable({warnOnUnregistered: false});
var tlm = require('vsts-task-lib/mock-task');
tlm.setAnswers(a);
mockery.registerMock('vsts-task-lib/task', tlm);
var ut = require('../src/utilities.js');

ut.copyFile(".\\DefaultTemplates\\default.windows.template.json", "F:\\somedir\\tempdir\\100");
if(!ut.isGreaterVersion({major: 0, minor: 11, patch: 5}, {major: 0, minor: 12, patch: 3})) {
    console.log("isGreaterVersion scenario 1 pass")
}

if(!ut.isGreaterVersion({major: 0, minor: 12, patch: 3}, {major: 0, minor: 12, patch: 3})) {
    console.log("isGreaterVersion scenario 2 pass")
}

if(ut.isGreaterVersion({major: 0, minor: 12, patch: 5}, {major: 0, minor: 12, patch: 3})) {
    console.log("isGreaterVersion scenario 3 pass")
}

if(ut.isGreaterVersion({major: 0, minor: 13, patch: 3}, {major: 0, minor: 12, patch: 3})) {
    console.log("isGreaterVersion scenario 4 pass")
}

if(ut.isGreaterVersion({major: 1, minor: 12, patch: 3}, {major: 0, minor: 12, patch: 3})) {
    console.log("isGreaterVersion scenario 5 pass")
}

if(!ut.isGreaterVersion({major: 0, minor: 12, patch: 1}, {major: 0, minor: 12, patch: 3})) {
    console.log("isGreaterVersion scenario 6 pass")
}

if(!ut.isGreaterVersion({major: 0, minor: 12, patch: 3}, {major: 1, minor: 12, patch: 3})) {
    console.log("isGreaterVersion scenario 7 pass")
}