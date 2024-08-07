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
process.env['AGENT_TEMPDIRECTORY'] = '.';
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
            "stdout": "0.12.3"
        },
        "packer -machine-readable --version": {
            "code": 0,
            "stdout": "1234567,,version,1.2.4"
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
            "stdout": process.env["__packer_build_fails__"] === "true" ? "packer build failed\r\nsome error" : "Executed Successfully\nOSDiskUri: https://bishalpackerimages.blob.core.windows.net/system/Microsoft.Compute/Images/packer/packer-osDisk.e2e08a75-2d73-49ad-97c2-77f8070b65f5.vhd\nStorageAccountLocation: SouthIndia",
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
    download: function(packerDownloadUrl, downloadPath) {
        if(process.env["__download_fails__"] === "true") {
            throw "packer download failed!!";
        }
        console.log('downloading from url ' + packerDownloadUrl + ' to ' + downloadPath);
    },
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
    },
    getTempDirectory: function() {
        return "F:\\somedir\\tempdir";
    },
    unzip: function(zipLocation, unzipLocation) {
        if(process.env["__extract_fails__"] === "true") {
            throw "packer zip extraction failed!!";
        }
        console.log('extracting from zip ' + zipLocation + ' to ' + unzipLocation);
    }
};

tr.registerMock('./utilities', utMock);
tr.registerMock('../utilities', utMock);

tr.setAnswers(a);
tr.run();