import ma = require("vsts-task-lib/mock-answer");
import tmrm = require("vsts-task-lib/mock-run");
import path = require("path");
import * as pkgMock from './helpers/locationmock';
import { HttpMock } from "./helpers/httpmock";

let taskPath = path.join(__dirname, "..", "testrun.js");
let outputPath = path.join(__dirname, "out", "packageOutput");
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set inputs
tr.setInput("packageType", "NuGet");
tr.setInput("feed", "feedId");
tr.setInput("view", "viewId");
tr.setInput("definition", "packageId");
tr.setInput("version", "versionId");
tr.setInput("downloadPath", outputPath);
tr.setInput("extract", "true");
tr.setInput("verbosity", "verbose");

// Set variables.
process.env["SYSTEM_TEAMFOUNDATIONCOLLECTIONURI"] = "https://abc.visualstudio.com/";
process.env["AGENT_VERSION"] = "2.116.0";
process.env["HOME"] = "/users/test";
process.env["ENDPOINT_AUTH_SYSTEMVSSCONNECTION"] =
    '{"scheme":"OAuth","parameters":{"AccessToken":"YWFtYWxsYWQ6ZXd0emE1bmN3MzN6c3lyM2NoN2prazUzejczamN6MnluNGtiNzd0ZXc0NnlhZzV2d3ZlcQ=="}}';

pkgMock.registerLocationHelpersMock(tr);
var httpMock = new HttpMock();
tr.registerMock('https', httpMock);
tr.registerMock('http', httpMock);
// // provide answers for task mock
// let a: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
//     which: {
//         cp: "/bin/cp"
//     },
//     checkPath: {
//         "/bin/cp": true
//     },
//     exist: {
//         downloadPath: true
//     }
// };
// tr.setAnswers(a);

tr.run();
