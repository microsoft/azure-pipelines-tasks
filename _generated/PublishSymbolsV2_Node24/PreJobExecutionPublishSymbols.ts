const path = require('path');
const clientToolUtils = require('azure-pipelines-tasks-packaging-common/universal/ClientToolUtilities');
const tl = require('azure-pipelines-task-lib');

const toolName = "symbol";

async function PreJobExecutionPublishSymbols(){
    tl.setResourcePath(path.join(__dirname, "task.json"));
    const UseNetCoreClientTool = tl.getBoolInput("UseNetCoreClientTool", false);

    try {
        // feature flag true or none Windows, then download NetCore version of client tool
        if (UseNetCoreClientTool || tl.osType() != "Windows_NT") {

            // Getting NetCore client tool
            tl.debug("Getting NetCore client tool");
            let clientToolFilePath = "/fake/path";

            // Downloading the correct version of Symbol to target location
            const accessToken = clientToolUtils.getSystemAccessToken();
            const serviceUri = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);
            const blobUri = await clientToolUtils.getBlobstoreUriFromBaseServiceUri(serviceUri, accessToken);

            tl.debug(tl.loc("Info_RetrievingClientToolUri", blobUri));

            // Downloading the client tool
            clientToolFilePath = await clientToolUtils.retryOnExceptionHelper(
                () => clientToolUtils.getClientToolFromService(
                    blobUri,
                    accessToken,
                    toolName), 3, 1000);

            tl.setTaskVariable('SYMBOLTOOL_FILE_PATH', clientToolFilePath);
        }

    } catch (error) {
        tl.error(error);
        tl.setResult(tl.TaskResult.Failed, tl.loc("PreJobFailedToExecute"));
    }
}

PreJobExecutionPublishSymbols()
