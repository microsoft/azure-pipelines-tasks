import { WebRequest, sendRequest } from 'azure-pipelines-tasks-utility-common/restutilities';
let uuid = require('uuid');
import * as tl from 'azure-pipelines-task-lib/task';
import * as dockerCommandUtils from "azure-pipelines-tasks-docker-common-v2/dockercommandutils";
import { writeFileSync } from 'fs';
import * as path from "path";
import  * as semver from "semver"


export interface TestSummary {
    "Total": number;
    "Pass": number;
    "Fail": number;
    "Results": TestResult[];
    "Duration": number;
}

export interface TestResult {
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

export class TestResultPublisher {

    public publishToTcm(testResults: TestSummary, testRunTitle: string) {
        let resultsFile = this.createResultsFile(JSON.stringify(testResults));

        const agentVersion = tl.getVariable('Agent.Version');
        if(semver.lt(agentVersion, "2.159.1")) {
            console.log(this.minimumAgentRequiredMsg);
            throw this.minimumAgentRequiredMsg;
        }

        if (!resultsFile) {
            tl.warning("Unable to create the results file, hence not publishing the test results");
            return;
        }
        try {
            var properties = <{ [key: string]: string }>{};
            properties['type'] = this.testRunType;
            properties['mergeResults'] = "false";
            properties['runTitle'] = testRunTitle;
            properties['resultFiles'] = resultsFile;
            properties['testRunSystem'] = this.testRunSystem;
            properties['publishRunAttachments'] = "true";

            tl.command('results.publish', properties, '');
            tl.debug("Finished publishing the test results to TCM");
        } catch(error) {
            tl.debug(`Unable to publish the test results because of ${error}`);
            throw error;
        }
    }

    public async publishToMetaDataStore(testSummary: TestSummary, imageName: string): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try{
                const request = new WebRequest();
                const accessToken: string = tl.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'ACCESSTOKEN', false);
                const requestUrl = tl.getVariable("System.TeamFoundationCollectionUri") + tl.getVariable("System.TeamProject") + "/_apis/deployment/attestationdetails?api-version=5.2-preview.1";
                const requestBody = this.getMetadataStoreUploadPayload(testSummary, imageName)

                request.uri = requestUrl;
                request.method = 'POST';
                request.body = JSON.stringify(requestBody);
                request.headers = {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + accessToken
                };
    
                tl.debug("requestUrl: " + requestUrl);
                tl.debug("requestBody: " + JSON.stringify(requestBody));

                try {
                    const response = await sendRequest(request);
                    tl.debug("Finished publishing the test results to MetaData Store");
                    resolve(response);
                }
                catch (error) {
                    tl.debug(`Unable to push to attestation Details to MetaData Store, Error:  ${error}`);
                    reject(error);
                }
    
            } catch(error) {
                tl.debug(`Unable to push the attestation details to MetaData Store: ${error}`)
                reject(error);
            }
        });
    }

    private createResultsFile(fileContent: string): string {
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

    private getTestTabUrl(): string {
      var pipeLineUrl = dockerCommandUtils.getPipelineLogsUrl();
      var testTabUrl = "";
      if (this.isBuild) {
        testTabUrl = pipeLineUrl + `&view=${this.testTabViewIdInBuild}`;
      } else {
          pipeLineUrl = pipeLineUrl + `&environmentId=${tl.getVariable("Release.EnvironmentId")}`;
          testTabUrl = pipeLineUrl + `&extensionId=${this.testTabViewIdInRelease}&_a=release-environment-extension`
      }
    
      return testTabUrl;
    }

    private getResourceUri(imageName: string): string {
        let inspectOutput = tl.execSync("docker", ["image", "inspect", imageName]);
        let imageDetails = JSON.parse(inspectOutput.stdout);
        let repoDigest = imageDetails[0].RepoDigests[0] as string;
        let digest = repoDigest.split(":")[1];
        let resourceName = this.getResourceName(imageName, digest);
        return resourceName
    }

    private getMetadataStoreUploadPayload(testSummary: TestSummary, imageName: string): any {
        const testPassPercentage = (testSummary.Pass/testSummary.Total) * 100;
        const resourceUri = this.getResourceUri(imageName);
        tl.debug(`Resource URI: ${resourceUri}`);

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
                url: this.getTestTabUrl(),
                label: "test-results-url"
              },
              {
                  url: dockerCommandUtils.getPipelineLogsUrl(),
                  label: "pipeline-run-url"
              }
            ]
          };

          return {
            name: uuid.v1(),
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
    }

    private getResourceName(image: string, digest: string): string {
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

    private readonly testRunType:string = "ContainerStructure";
    private readonly testRunSystem:string = "VSTS-PTR";
    private readonly testTabViewIdInBuild = "ms.vss-test-web.build-test-results-tab";
    private readonly testTabViewIdInRelease = "ms.vss-test-web.test-result-in-release-environment-editor-tab";
    private readonly buildString = "build";
    private readonly hostType = tl.getVariable("System.HostType").toLowerCase();
    private readonly isBuild = this.hostType === this.buildString;
    private readonly minimumAgentRequiredMsg: string = "Minimum agent required to publish the test results to Azure DevOps is greater than or equal to 2.159.0";
}