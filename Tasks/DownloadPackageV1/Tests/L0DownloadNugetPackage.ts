import tmrm = require("azure-pipelines-task-lib/mock-run");
import path = require("path");
import { WebApiMock } from "./helpers/webapimock";

let taskPath = path.join(__dirname, "..", "main.js");
let outputPath: string = path.join(__dirname, "out", "packageOutput");
let tempPath: string = path.join(__dirname, "temp");
let zipLocation: string = path.join(tempPath, "singlePackageName.nupkg");
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set inputs
tr.setInput("packageType", "nuget");
tr.setInput("feed", "/feedId");
tr.setInput("view", "viewId");
tr.setInput("definition", "6f598cbe-a5e2-4f75-aa78-e0fd08301a15");
tr.setInput("version", "versionId");
tr.setInput("downloadPath", outputPath);
tr.setInput("extract", "true");
tr.setInput("verbosity", "verbose");

// Set variables.
process.env["AGENT_TEMPDIRECTORY"] = tempPath;
process.env["SYSTEM_TEAMFOUNDATIONCOLLECTIONURI"] = "https://abc.visualstudio.com/";
process.env["AGENT_VERSION"] = "2.116.0";
process.env["HOME"] = "/users/test";

// provide answers for task mock
tr.setAnswers({
    exist: {
        [outputPath]: true,
        [tempPath]: true
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
