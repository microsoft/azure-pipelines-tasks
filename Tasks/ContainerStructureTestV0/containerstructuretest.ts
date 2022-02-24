import * as tl from 'azure-pipelines-task-lib/task';
import * as path from "path";
import { WebResponse } from 'azure-pipelines-tasks-utility-common/restutilities';
import { ContainerRegistry } from "./containerregistry";
import { TestResultPublisher, TestSummary } from "./testresultspublisher";
import { TestRunner } from "./testrunner";

const telemetryArea: string = 'TestExecution';
const telemetryFeature: string = 'ContainerStructureTestTask';
const telemetryData: { [key: string]: any; } = <{ [key: string]: any; }>{};
const defaultRunTitlePrefix: string = 'ContainerStructureTest_TestResults_';
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
        const endpointId = tl.getInput("dockerRegistryServiceConnection");
        let tagInput = tl.getInput('tag');
        const tag = tagInput ? tagInput : "latest";
        const testRunTitle = testRunTitleInput ? testRunTitleInput : `${defaultRunTitlePrefix}${artifactId}`;
        const failTaskOnFailedTests: boolean = tl.getInput('failTaskOnFailedTests').toLowerCase() == 'true' ? true : false;

        tl.setResourcePath(path.join(__dirname, 'task.json'));

        let image;
        if (endpointId) {
            // Establishing registry connection and pulling the container.
            let containerRegistry = new ContainerRegistry(endpointId);
            tl.debug(`Successfully finished docker login`);
            image = `${containerRegistry.getQualifiedImageName(repository, tag)}`;
            tl.debug(`Image: ${image}`);
            await containerRegistry.pull(repository, tag);
            tl.debug(`Successfully finished docker pull`);
        } else {
            image = `${repository}:${tag}`;
            tl.debug(`Local image: ${image}`);
        }

        // Running the container structure test on the above pulled container.
        const testRunner = new TestRunner(testFilePath, image);
        let resultObj: TestSummary = await testRunner.Run();

        // Publishing the test results to TCM.
        // Not failing task if there are any errors while publishing.
        let testResultPublisher = new TestResultPublisher();
        try {
            testResultPublisher.publishToTcm(resultObj, testRunTitle);
            telemetryData["TCMPublishStatus"] = true;
            tl.debug("Finished publishing the test results to TCM");
        } catch(error) {
            telemetryData["TCMPublishError"] = error;
        }

        // Publishing the test results to Metadata Store.
        try {
            var response:WebResponse = await testResultPublisher.publishToMetaDataStore(resultObj, image);
            console.log(`Publishing test data to metadata store. Status: ${response.statusCode} and Message : ${response.statusMessage}`)
            tl.debug(`Response from publishing the test details to MetaData store: ${JSON.stringify(response)}`);
            telemetryData["MetaDataPublishStatus"] = true;
        } catch(error) {
            telemetryData["MetaDataPublishError"] = error;
        }

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

function publishTelemetry() {
    try {
        console.log(`##vso[telemetry.publish area=${telemetryArea};feature=${telemetryFeature}]${JSON.stringify(telemetryData)}`);
    }
    catch (err) {
        tl.debug(`Error in writing telemetry : ${err}`);
    }
}

run();