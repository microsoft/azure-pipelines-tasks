import * as tl from 'azure-pipelines-task-lib/task';
import { chmodSync, writeFileSync, existsSync } from 'fs';
import * as path from "path";
import downloadutility = require("utility-common/downloadutility");
import RegistryAuthenticationToken from "docker-common-v2/registryauthenticationprovider/registryauthenticationtoken";
import ContainerConnection from "docker-common-v2/containerconnection";
import { getDockerRegistryEndpointAuthenticationToken } from "docker-common-v2/registryauthenticationprovider/registryauthenticationtoken";
import * as dockerCommandUtils from "docker-common-v2/dockercommandutils";
import { WebRequest, WebResponse, sendRequest } from 'utility-common-v2/restutilities';
let uuid = require('uuid');

interface TestSummary {
    "Total": number;
    "Pass": number;
    "Fail": number;
    "Results": TestResult[];
    "Duration": number;
}

interface TestResult {
    "Name": string;
    "Pass": boolean;
    "Errors": string[] | undefined;
}

interface TestAttestation {
    "testId": string;
    "testTool": string;
    "testResult": TestResultAttestation;
    "testDurationSeconds": number;
    "testPassPercentage": string;
    "relatedUrls": RelatedUrls[];
}

interface TestResultAttestation {
    "total": number;
    "passed": number;
    "failed": number;
    "skipped": number;
}

interface RelatedUrls {
    "url": string;
    "label": string;
}

const telemetryArea: string = 'TestExecution';
const telemetryFeature: string = 'PublishTestResultsTask';
const telemetryData: { [key: string]: any; } = <{ [key: string]: any; }>{};
const defaultRunTitlePrefix: string = 'ContainerStructureTest_TestResults_';
const testTabViewIdInBuild = "ms.vss-test-web.build-test-results-tab";
const testTabViewIdInRelease = "ms.vss-test-web.test-result-in-release-environment-editor-tab";
const buildString = "build";
const hostType = tl.getVariable("System.HostType").toLowerCase();
const isBuild = hostType === buildString;
const osType = tl.osType().toLowerCase();

async function run() {
    let taskResult = true;
    try {
        tl.debug(`Os Type: ${osType}`);
        telemetryData["OsType"] = osType;

        if(osType == "windows_nt") {
            throw new Error(tl.loc('NotSupportedOS', osType));
        }

        const artifactId = isBuild ? parseInt(tl.getVariable("Build.BuildId")) : parseInt(tl.getVariable("Release.ReleaseId"));
        const testFilePath = tl.getInput('configFile', true);
        const repository = tl.getInput('repository', true);
        const testRunTitleInput = tl.getInput('testRunTitle');
        let tagInput = tl.getInput('tag');
        const tag = tagInput ? tagInput : "latest";
        const testRunTitle = testRunTitleInput ? testRunTitleInput : `${defaultRunTitlePrefix}${artifactId}`;

        let endpointId = tl.getInput("dockerRegistryServiceConnection");
        const failTaskOnFailedTests: boolean = tl.getInput('failTaskOnFailedTests').toLowerCase() == 'true' ? true : false;

        tl.setResourcePath(path.join(__dirname, 'task.json'));
        let registryAuthenticationToken: RegistryAuthenticationToken = getDockerRegistryEndpointAuthenticationToken(endpointId);
        let connection = new ContainerConnection();

        connection.open(null, registryAuthenticationToken, true, false);
        tl.debug(`Successfully finished docker login`);

        const image = `${connection.getQualifiedImageName(repository, true)}:${tag}`;
        tl.debug(`Image: ${image}`)
        await dockerPull(connection, image);
        tl.debug(`Successfully finished docker pull`);

        const downloadUrl = getContainerStructureTestRunnerDownloadPath(osType);
        if (!downloadUrl) {
            return;
        }

        tl.debug(`Successfully downloaded : ${downloadUrl}`);
        const runnerPath = await downloadTestRunner(downloadUrl);

        var start = _getCurrentTime();
        const output: string = runContainerStructureTest(runnerPath, testFilePath, image);
        var end = _getCurrentTime();

        if (!output || output.length <= 0) {
            throw new Error("No output from runner");
        }

        tl.debug(`Successfully finished testing`);
        let resultObj: TestSummary = JSON.parse(output);
        resultObj.Duration = end-start;
        console.log(`Total Tests: ${resultObj.Total}, Pass: ${resultObj.Pass}, Fail: ${resultObj.Fail}`);

        publishTheTestResultsToTCM(output, testRunTitleInput);

        var response:WebResponse = await publishTestResultsToMetadataStore(image, resultObj, testRunTitle);
        console.log(`Publishing test data to metadata store. Status: ${response.statusCode} and Message : ${response.statusMessage}`)
        tl.debug(`Response from publishing the test details to MetaData store: ${JSON.stringify(response)}`);

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

function _getCurrentTime() {
    return new Date().getTime();
}

async function dockerPull(connection: ContainerConnection, imageName: string): Promise<any> {
    return new Promise<any>((resolve, reject) => {
        try {
            dockerCommandUtils.command(connection, "pull", imageName, (output: any) => {
                resolve(output);
            })
        } catch (error) {
            reject(error);
        }
    });
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

function publishTheTestResultsToTCM(jsonResultsString: string, runTitle: string) {
    let resultsFile = createResultsFile(jsonResultsString);

    if (!resultsFile) {
        tl.warning("Unable to create the results file, hence not publishing the test results");
        return;
    }
    try {
        var properties = <{ [key: string]: string }>{};
        properties['type'] = "ContainerStructure";
        properties['mergeResults'] = "false";
        properties['runTitle'] = runTitle;
        properties['resultFiles'] = resultsFile;
        properties['testRunSystem'] = "VSTS-PTR";
    
        tl.command('results.publish', properties, '');
        telemetryData["TCMPublishStatus"] = true;
        tl.debug("Finished publishing the test results to TCM");
    } catch(error) {
        tl.debug(`Unable to publish the test results because of ${error}`);
        telemetryData["TCMPublishError"] = error;
    }
}

async function publishTestResultsToMetadataStore(imageName:string, testSummary: TestSummary, testRunTitle: string):Promise<any> {

    return new Promise(async (resolve, reject) => {
        try{
            const request = new WebRequest();
            const accessToken: string = tl.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'ACCESSTOKEN', false);
            const requestUrl = tl.getVariable("System.TeamFoundationCollectionUri") + tl.getVariable("System.TeamProject") + "/_apis/deployment/attestationdetails?api-version=5.2-preview.1";
            const resourceUri = getResourceUri(imageName);
            const testPassPercentage = (testSummary.Pass/testSummary.Total) * 100;
            const testSummaryJson: TestAttestation = {
                testId: "ContainerStructureTestV0",
                testTool: "container-structure-test",
                testResult: {
                  total: testSummary.Total,
                  passed: testSummary.Pass,
                  failed: testSummary.Fail,
                  skipped: 0
                } as TestResultAttestation,
                testDurationSeconds: testSummary.Duration,
                testPassPercentage: testPassPercentage.toString(),
                relatedUrls: [
                  {
                    url: getTestTabUrl(),
                    label: "test-results-url"
                  },
                  {
                      url: dockerCommandUtils.getPipelineLogsUrl(),
                      label: "pipeline-run-url"
                  },
                  {
                      url: getContainerStructureTestRunnerDownloadPath(osType),
                      label: "test-runner-url"
                  }
                ]
              };
            tl.debug(`Resource URI: ${resourceUri}`);
            const requestBody = {
                name: getAttestationName(),
                description: "Test Results from Container structure test",
                resourceUri:[resourceUri],
                kind: "ATTESTATION",
                relatedUrl: [
                  {
                    url: dockerCommandUtils.getPipelineUrl(),
                    label: "pipeline-url"
                  }
                ],
                humanReadableName: "Container Structure test results",
                serializedPayload: JSON.stringify(testSummaryJson)
            };

            request.uri = requestUrl;
            request.method = 'POST';
            request.body = JSON.stringify(requestBody);
            request.headers = {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + accessToken
            };

            tl.debug("requestUrl: " + requestUrl);
            tl.debug("requestBody: " + JSON.stringify(requestBody));
            tl.debug("accessToken: " + accessToken);

            try {
                tl.debug("Sending request for pushing image to Image meta data store");
                const response = await sendRequest(request);
                tl.debug("Finished publishing the test results to TCM");
                telemetryData["MetaDataPublishStatus"] = true;
                resolve(response);
            }
            catch (error) {
                tl.debug(`Unable to push to attestation Details Artifact Store, Error:  ${error}`);
                telemetryData["MetaDataPublishError"] = error;
                reject(error);
            }

        } catch(error) {
            tl.debug(`Unable to push the attestation details ${error}`)
            reject(error);
        }
    });
}

function getAttestationName(): string {
    return `projects/${tl.getVariable("System.TeamProject")}/notes/${uuid.v1()}`
}

function getTestTabUrl(): string {
  var pipeLineUrl = dockerCommandUtils.getPipelineLogsUrl();
  var testTabUrl = "";
  if (isBuild) {
    testTabUrl = pipeLineUrl + `&view=${testTabViewIdInBuild}`;
  } else {
      pipeLineUrl = pipeLineUrl + `&environmentId=${tl.getVariable("Release.EnvironmentId")}`;
      testTabUrl = pipeLineUrl + `&extensionId=${testTabViewIdInRelease}&_a=release-environment-extension`
  }

  return testTabUrl;
}

function getResourceUri(imageName: string): string {
    let inspectOutput = tl.execSync("docker", ["image", "inspect", imageName]);
    let imageDetails = JSON.parse(inspectOutput.stdout);
    let repoDigest = imageDetails[0].RepoDigests[0] as string;
    let digest = repoDigest.split(":")[1];
    let resourceName = getResourceName(imageName, digest);
    return resourceName
}

function publishTelemetry() {
    try {
        console.log(`##vso[telemetry.publish area=${telemetryArea};feature=${telemetryFeature}]${JSON.stringify(telemetryData)}`);
    }
    catch (err) {
        tl.debug(`Error in writing telemetry : ${err}`);
    }
}

function getResourceName(image: string, digest: string): string {
    var match = image.match(/^(?:([^\/]+)\/)?(?:([^\/]+)\/)?([^@:\/]+)(?:[@:](.+))?$/);
    if (!match) {
        return null;
    }

    var registry = match[1];
    var namespace = match[2];
    var repository = match[3];
    var tag = match[4];
  
    if (!namespace && registry && !/[:.]/.test(registry)) {
      namespace = registry
      registry = 'docker.io'
    }

    if (!namespace && !registry) {
      registry = 'docker.io'
      namespace = 'library'
    }

    registry = registry ? registry + '/' : '';
    namespace = namespace ? namespace + '/' : '';
    
    return "https://" + registry  + namespace  + repository + "@sha256:" + digest;
  }

run();