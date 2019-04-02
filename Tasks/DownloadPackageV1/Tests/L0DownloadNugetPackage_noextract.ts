import tmrm = require("azure-pipelines-task-lib/mock-run");
import path = require("path");
import { WebApiMock } from "./helpers/webapimock";

let taskPath = path.join(__dirname, "..", "main.js");
let outputPath: string = path.join(__dirname, "out", "packageOutput");
let zipLocation: string = path.join(outputPath, "singlePackageName.nupkg");
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set inputs
tr.setInput("packageType", "nuget");
tr.setInput("feed", "feedId");
tr.setInput("view", "viewId");
tr.setInput("definition", "packageId");
tr.setInput("version", "versionId");
tr.setInput("downloadPath", outputPath);
tr.setInput("extract", "false");
tr.setInput("verbosity", "verbose");

// Set variables.
process.env["SYSTEM_TEAMFOUNDATIONCOLLECTIONURI"] = "https://abc.visualstudio.com/";
process.env["AGENT_VERSION"] = "2.116.0";
process.env["HOME"] = "/users/test";
process.env["ENDPOINT_AUTH_SYSTEMVSSCONNECTION"] =
    '{"scheme":"OAuth","parameters":{"AccessToken":"YWFtYWxsYWQ6ZXd0emE1bmN3MzN6c3lyM2NoN2prazUzejczamN6MnluNGtiNzd0ZXc0NnlhZzV2d3ZlcQ=="}}';

// provide answers for task mock
tr.setAnswers({
    exist: {
        [outputPath]: true
    },
    rmRF: {
        [zipLocation]: {
            success: true
        }
    }
});

// Register connections mock
tr.registerMock("./connections", {
    getConnection: function(): Promise<any> {
        return Promise.resolve(new WebApiMock());
    }
});

tr.registerMock("./universal", {
    downloadUniversalPackage: function(
        downloadPath: string,
        feedId: string,
        packageId: string,
        version: string
    ): Promise<void> {
        return;
    }
});

tr.run();
