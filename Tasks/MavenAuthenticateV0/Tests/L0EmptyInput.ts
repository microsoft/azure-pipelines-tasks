import tmrm = require("azure-pipelines-task-lib/mock-run");
import path = require("path");

let taskPath = path.join(__dirname, "..", "mavenauth.js");
let tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

// Set inputs
tr.setInput("feeds", "");
tr.setInput("verbosity", "verbose");
tr.setInput("serviceEndpoints", "");
process.env["ENDPOINT_AUTH_SYSTEMVSSCONNECTION"] =
    '{"scheme":"OAuth","parameters":{"AccessToken":"YWFtYWxsYWQ6ZXd0emE1bmN3MzN6c3lyM2NoN2prazUzejczamN6MnluNGtiNzd0ZXc0NnlhZzV2d3ZlcQ=="}}';

tr.run();
