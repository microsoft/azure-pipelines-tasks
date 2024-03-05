import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..\\src\\main.js');
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput('templateType', 'custom');
tr.setInput('customTemplateLocation', 'C:\\custom.template.json');
tr.setInput('imageUri', 'imageUri');
tr.setInput('imageStorageAccount', 'imageStorageAccount');
tr.setInput("additionalBuilderParameters", "{}");
tr.setInput("customTemplateParameters", "{\"client_id\": \"abcdef\", \"drop-location\":\"C:\\\\folder 1\\\\folder-2\"}");

process.env["RELEASE_RELEASENAME"] = "Release-1";

// provide answers for task mock
let a: any = <any>{
    "which": {
        "packer": "packer"
    },
    "checkPath": {
        "packer": true,
        "C:\\custom.template.json": true
    },
    "exec": {
        "packer --version": {
            "code": 0,
            "stdout": "1.2.4"
        },
        "packer fix -validate=false C:\\custom.template.json": {
            "code": 0,
            "stdout": "{ \"some-key\": \"some-value\" }"
        },
        "packer validate -var-file=C:\\somefolder\\somevarfile.json -var-file=C:\\somefolder\\somevarfile.json C:\\custom.template-fixed.json": {
            "code": 0,
            "stdout": "Executed Successfully"
        },
        "packer build -force -color=false -var-file=C:\\somefolder\\somevarfile.json -var-file=C:\\somefolder\\somevarfile.json C:\\custom.template-fixed.json": {
            "code": process.env["__packer_build_fails__"] === "true" ? 1 : 0,
            "stdout": process.env["__packer_build_fails__"] === "true" ? "packer build failed\r\nsome error" : "Executed Successfully\nManagedImageResourceGroupName: packer-managed-res-grp\nManagedImageName: builtInWinManagedImageName\nManagedImageLocation: SouthIndia",
         }
    },
    "exist": {
        "C:\\": true,
        "packer": true
    },
    "rmRF": {
        "C:\\": { 'success': true }
    },
    "osType": {
        "osType": "Windows_NT"
    }
};

var ut = require('../src/utilities');
var utMock = {
    IsNullOrEmpty : ut.IsNullOrEmpty,
    HasItems : ut.HasItems,
    StringWritable: ut.StringWritable,
    PackerVersion: ut.PackerVersion,
    isGreaterVersion: ut.isGreaterVersion,
    deleteDirectory: function(dir) {
        console.log("rmRF " + dir);
    },
    copyFile: function(source: string, destination: string) {
        if(process.env["__copy_fails__"] === "true") {
            throw "copy failed";
        } else {
            console.log('copying ' + source + ' to ' + destination);
        }
    },
    generateTemporaryFilePath: function () {
        return "C:\\somefolder\\somevarfile.json";
    },
    getPackerVarFileContent: function(variables) {
        return ut.getPackerVarFileContent(variables);
    },
    writeFile: function(filePath: string, content: string) {
        console.log("writing to file " + filePath + " content: " + content);
    },
    findMatch: function(root: string, patterns: string[] | string) {
        return [patterns];
    },
    getCurrentTime: function() {
        return 100;
    },
    getCurrentDirectory: function() {
        return "basedir\\currdir";
    }
};

tr.registerMock('./utilities', utMock);
tr.registerMock('../utilities', utMock);

tr.setAnswers(a);
tr.run();