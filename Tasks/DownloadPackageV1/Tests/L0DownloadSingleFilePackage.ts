import ma = require("vsts-task-lib/mock-answer");
import tmrm = require("vsts-task-lib/mock-run");
import path = require("path");
import fs = require("fs");
import * as pkgMock from "./locationHelpersMock";

let taskPath = path.join(__dirname, "..", "testrun.js");
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set inputs
tr.setInput("packageType", "NuGet");
tr.setInput("feed", "feedId");
tr.setInput("view", "viewId");
tr.setInput("definition", "packageId");
tr.setInput("version", "versionId");
tr.setInput("downloadPath", "downloadPath");
tr.setInput("extract", "true");

// Set variables.
process.env["SYSTEM_TEAMFOUNDATIONCOLLECTIONURI"] = "https://abc.visualstudio.com/";
process.env["AGENT_VERSION"] = "2.116.0";
process.env["HOME"] = "/users/test";
process.env["ENDPOINT_AUTH_SYSTEMVSSCONNECTION"] =
    '{"scheme":"OAuth","parameters":{"AccessToken":"YWFtYWxsYWQ6ZXd0emE1bmN3MzN6c3lyM2NoN2prazUzejczamN6MnluNGtiNzd0ZXc0NnlhZzV2d3ZlcQ=="}}';

pkgMock.registerLocationHelpersMock(tr);

tr.registerMock("fs", {
    createWriteStream: function(path) {
        return {
            on: function(event: any, callback: any) {
                return null;
            },
            once: function(event: any, callback: any) {
                return null;
            },
            emit: function(event: any, callback: any) {
                return null;
            },
            write: function(data: any, callback: any) {
                console.log("data " + data);
                return null;
            },
            end:function(event: any, callback: any) {
                return null;
            }
        };
    },
    writeFileSync: function(path, data) {
        return data;
    },
    readFileSync: function(path) {
        return "hello";
    },
    statSync: function(fd) {
        return {};
    }
});
tr.setInput('verbosity', "verbose");

// provide answers for task mock
let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    which: {
        cp: "/bin/cp"
    },
    checkPath: {
        "/bin/cp": true
    },
    exist: {
        "downloadPath": true
    }
};
tr.setAnswers(a);

tr.run();
