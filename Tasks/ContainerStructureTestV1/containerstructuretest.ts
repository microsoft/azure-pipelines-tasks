import * as tl from 'azure-pipelines-task-lib/task';
import { chmodSync, writeFileSync, existsSync } from 'fs';
import * as path from "path";
import downloadutility = require("utility-common/downloadutility");
let uuid = require('uuid');

interface TestSummary {
    "Total": number;
    "Pass": number;
    "Fail": number;
    "Results": TestResult[];

}

interface TestResult {
    "Name": string;
    "Pass": boolean;
    "Errors": string[] | undefined;
}

const telemetryArea: string = 'TestExecution';
const telemetryFeature: string = 'PublishTestResultsTask';
const telemetryData: { [key: string]: any; } = <{ [key: string]: any; }>{};


async function run() {
    let taskResult = true;
    try {
        const osType = tl.osType().toLowerCase();
        tl.debug(`Os Type: ${osType}`);
        telemetryData["OsType"] = osType;

        const testFilePath = tl.getInput('testFile', true);
        const image = tl.getInput('image', true);
        const failTaskOnFailedTests: boolean = tl.getInput('failTaskOnFailedTests').toLowerCase() == 'true' ? true : false;

        const downloadUrl = getContainerStructureTestRunnerDownloadPath(osType);
        if (!downloadUrl) {
            return;
        }

        const runnerPath = await downloadTestRunner(downloadUrl);
        const output: string = runContainerStructureTest(runnerPath, testFilePath, image);

        if (!output || output.length <= 0) {
            throw new Error("No output from runner");
        }

        let resultObj: TestSummary = JSON.parse(output);
        tl.debug(`Total Tests: ${resultObj.Total}, Pass: ${resultObj.Pass}, Fail: ${resultObj.Fail}`);

        publishTheTestResultsToTCM(output);
        publishTestResultsToMetadataStore(resultObj);

        if (failTaskOnFailedTests && resultObj && resultObj.Fail > 0) {
            taskResult = false;
        }
    } catch (error) {
        tl.error(error);
        telemetryData["Exception"] = error;
        taskResult = false;
    } finally {
        tl.setResult(taskResult ? tl.TaskResult.Succeeded : tl.TaskResult.Failed, '');
        telemetryData["TaskResult"] = taskResult;
        publishTelemetry();
        tl.debug("Finished Execution");
    }
}

function createResultsFile(fileContent: string): string {
    let resultFilePath: string = null;
    try {
        const agentTempDirectory = tl.getVariable('Agent.TempDirectory');
        resultFilePath = path.join(agentTempDirectory, uuid.v1() + '.json');

        writeFileSync(resultFilePath, fileContent);
    } catch (ex) {
        tl.warning(`Exception while creating results file: ${ex}`);
        return null;
    }

    return resultFilePath;
}

function getContainerStructureTestRunnerDownloadPath(osType: string): string {
    switch (osType) {
        case 'darwin':
            return "https://storage.googleapis.com/container-structure-test/latest/container-structure-test-darwin-amd64";
        case 'linux':
            return "https://storage.googleapis.com/container-structure-test/latest/container-structure-test-linux-amd64";
        default:
            return null;
    }
}

async function downloadTestRunner(downloadUrl: string): Promise<string> {
    const gcst = path.join(__dirname, "container-structure-test");
    return downloadutility.download(downloadUrl, gcst, false, true).then((res) => {
        chmodSync(gcst, "777");
        if (!existsSync(gcst)) {
            tl.error(tl.loc('FileNotFoundException', path));
            throw new Error(tl.loc('FileNotFoundException', path));
        }
        telemetryData["DownloadStatus"] = true;
        return gcst;
    }).catch((reason) => {
        telemetryData["DownloadStatus"] = false;
        telemetryData["DownloadError"] = reason;
        tl.error(tl.loc('DownloadException', reason));
        throw new Error(tl.loc('DownloadException', reason));
    })
}

function runContainerStructureTest(runnerPath: string, testFilePath: string, image: string): string {
    let command = tl.tool(runnerPath);
    command.arg(["test", "--image", image, "--config", testFilePath, "--json"]);

    const output = command.execSync();
    let jsonOutput: string;

    if (!output.error) {
        jsonOutput = output.stdout;
    } else {
        tl.error(tl.loc('ErrorInExecutingCommand', output.error));
        throw new Error(tl.loc('ErrorInExecutingCommand', output.error));
    }

    tl.debug("Standard Output: " + output.stdout);
    tl.debug("Standard Error: " + output.stderr);
    tl.debug("Error from command executor: " + output.error);
    tl.debug("Return code from command executor: " + output.code);

    return jsonOutput;
}

function publishTheTestResultsToTCM(jsonResutlsString: string) {
    let resultsFile = createResultsFile(jsonResutlsString);

    if (!resultsFile) {
        tl.warning("Unable to create the resutls file, hence not publishg the test results");
        return;
    }

    var properties = <{ [key: string]: string }>{};
    properties['type'] = "ContainerStructure";
    properties['mergeResults'] = "false";
    properties['runTitle'] = "Container Structure Tests";
    properties['resultFiles'] = resultsFile;
    properties['testRunSystem'] = "VSTS-PTR";

    tl.command('results.publish', properties, '');
    telemetryData["TCMPublishStatus"] = true;
}

function publishTestResultsToMetadataStore(testSummary: TestSummary) {
}

function publishTelemetry() {
    try {
        console.log(`##vso[telemetry.publish area=${telemetryArea};feature=${telemetryFeature}]${JSON.stringify(telemetryData)}`);
    }
    catch (err) {
        tl.debug(`Error in writing telemetry : ${err}`);
    }
}

run();