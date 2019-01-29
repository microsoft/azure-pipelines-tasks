import fs = require("fs");
import tl = require("vsts-task-lib/task");
import kusto = require("./kusto");
import utils = require("./utils");

// Initialize telemetry
var taskStartTime = process.hrtime();
var taskId = utils.uuidv4();
var requestTelemetry = {
    name: "PublishToKusto",
    url: process.env["SYSTEM_TEAMFOUNDATIONCOLLECTIONURI"],
    duration: 0, // in ms
    resultCode: "500",
    success: false,
    properties: {
        teamFoundationCollectionUri: process.env["SYSTEM_TEAMFOUNDATIONCOLLECTIONURI"],
        buildRepositoryName: process.env["BUILD_REPOSITORY_NAME"],
        taskId: taskId
    }
};

async function run() {
    try {
        // Get input parameters
        var filesPattern = tl.getInput("files", /*required*/true);
        var kustoEndpoints = kusto.splitEndpointUrls(tl.getInput("kustoUrls", /*required*/true));
        var aadClientId = tl.getInput("aadClientId", /*required*/true);
        var aadClientSecret = tl.getInput("aadClientSecret", /*required*/true);
        var singleCommand = tl.getBoolInput("singleCommand", /*required*/false);
        
        var filePaths = tl.findMatch("", filesPattern);
        console.log("File pattern " + filesPattern + " matched " + filePaths.length + " file(s): " + JSON.stringify(filePaths));

        var accessToken = await utils.getAccessToken('https://microsoft/kusto', aadClientId, aadClientSecret);

        for (var filePath of filePaths) {
            console.log("Reading file " + filePath);
            var script = fs.readFileSync(filePath, { encoding: "utf-8" });

            var commands = kusto.getCommands(script, singleCommand);
            for (var command of commands) {

                // Skip function validation as function may get published out of dependency order when they are spread across multiple files
                command = kusto.insertFunctionValidationSkipping(command);

                // Deploy to all Kusto endpoints in parallel
                var promises = new Array<Promise<void>>();
                for (var endpoint of kustoEndpoints) {
                    promises.push(kusto.executeCommand(endpoint.cluster, endpoint.database, command, accessToken));
                }
                for (var promise of promises) {
                    await promise;
                }
            }
        }

        requestTelemetry.success = true;
        requestTelemetry.resultCode = "200";
        tl.setResult(tl.TaskResult.Succeeded, "Done");
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

run();

// Finish tracking the task
var taskEndTime = process.hrtime(taskStartTime);
requestTelemetry.duration = (taskEndTime[0] * 1000) + (taskEndTime[1] / 1000000);
