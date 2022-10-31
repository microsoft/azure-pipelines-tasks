import tl = require('azure-pipelines-task-lib/task');
import jsonPath = require('JSONPath');
import webClient = require('azure-pipelines-tasks-azure-arm-rest-v2/webClient');
import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azureModels';
import { ServiceClient } from 'azure-pipelines-tasks-azure-arm-rest-v2/AzureServiceClient';
import { ToError } from 'azure-pipelines-tasks-azure-arm-rest-v2/AzureServiceClientBase';
import { uploadFileToSasUrl } from './azure-storage';
import https = require('https');
import { parse } from 'azure-pipelines-tasks-webdeployment-common-v4/ParameterParserUtility';

export const SourceType = {
    JAR: "Jar",
    SOURCE_DIRECTORY: "Source",
    DOT_NET_CORE_ZIP: "NetCoreZip",
    CUSTOM_CONTAINER: "Container"
}

class UploadTarget {
    private _sasUrl: string;
    private _relativePath: string;

    constructor(sasUrl: string, relativePath: string) {
        this._sasUrl = sasUrl;
        this._relativePath = relativePath;
    }

    public get sasUrl(): string {
        return this._sasUrl;
    }

    public get relativePath(): string {
        return this._relativePath;
    }
}

interface ImageRegistryCredential {
    username?: string;
    password?: string;
}

interface CustomContainer {
    args?: string[];
    command?: string[];
    containerImage: string;
    imageRegistryCredential?: ImageRegistryCredential;
    languageFramework?: string;
    server?: string;
}

const ASYNC_OPERATION_HEADER = 'azure-asyncoperation';
const API_VERSION = '2022-03-01-preview';
const LOCATION_HEADER = 'location';

export class AzureSpringCloud {
    private _resourceId: string;
    private _client: ServiceClient;

    constructor(endpoint: AzureEndpoint, resourceId: string) {
        tl.debug('Initializeing service client');
        this._client = new ServiceClient(endpoint.applicationTokenCredentials, endpoint.subscriptionID, 30);
        this._resourceId = resourceId;
        tl.debug('Finished initializeing service client');
    }

    /**
     * Encapsulates sending of Azure API requests.
     * @param method 
     * @param url 
     * @param body 
     */
    protected sendRequest(method: string, url: string, body?: any): Promise<webClient.WebResponse> {
        var httpRequest = new webClient.WebRequest();
        httpRequest.method = method;
        httpRequest.uri = url;
        if (body)
            httpRequest.body = body;
        tl.debug(`Sending ${method} request to ${url}`);
        return this._client.beginRequest(httpRequest);
    }

    /**
     * Deploys an artifact to an Azure Spring Cloud deployment
     * @param artifactToUpload 
     * @param appName 
     * @param deploymentName 
     * @param createDeployment If true, a new deployment will be created or the prior one will be completely overriden. If false, only the changes to the prior deployment will be applied.
     * @param jvmOptions 
     * @param environmentVariables 
     */
    public async deploy(artifactToUpload: string, sourceType: string, appName: string, deploymentName: string, createDeployment: boolean,
        runtime?: string, jvmOptions?: string, environmentVariables?: string,
        dotNetCoreMainEntryPath?: string, version?: string): Promise<void> {
        //Get deployment URL
        tl.debug('Starting deployment.');
        try {
            const deploymentTarget = await this.getUploadTarget(appName);
            await uploadFileToSasUrl(deploymentTarget.sasUrl, artifactToUpload);
            const deploymentUpdateRequestBody = this.prepareDeploymentUpdateRequestBody(deploymentTarget.relativePath, sourceType, runtime, jvmOptions, environmentVariables, dotNetCoreMainEntryPath, version, null, null);
            await this.applyDeploymentModifications(appName, deploymentName, deploymentUpdateRequestBody, createDeployment);
        } catch (error) {
            throw error;
        }
    }

    /**
     * Deploys a custom image to an Azure Spring Cloud deployment
     * @param appName 
     * @param deploymentName 
     * @param createDeployment If true, a new deployment will be created or the prior one will be completely overriden. If false, only the changes to the prior deployment will be applied.
     * @param environmentVariables 
     */
     public async deployCustomContainer(appName: string, deploymentName: string, createDeployment: boolean,
        containerRegistry?: string,
        registryUsername?: string,
        registryPassword?: string,
        containerImage?: string,
        containerCommand?: string,
        containerArgs?: string,
        languageFramework?: string,
        environmentVariables?: string,
        version?: string): Promise<void> {
        try {
            let customContainer: CustomContainer = {
                containerImage: containerImage,
            };
            if (containerArgs) {
                customContainer.args = this.splitCommands(containerArgs);
            }
            if (containerCommand) {
                customContainer.command = this.splitCommands(containerCommand);
            }
            if (registryUsername || registryPassword) {
                customContainer.imageRegistryCredential = {
                    username: registryUsername,
                    password: registryPassword,
                };
            }
            if (languageFramework) {
                customContainer.languageFramework = languageFramework;
            }
            if (containerRegistry) {
                customContainer.server = containerRegistry;
            }
            tl.debug('Deploying custom container: ' + JSON.stringify(customContainer));

            const deploymentUpdateRequestBody = this.prepareDeploymentUpdateRequestBody(null, SourceType.CUSTOM_CONTAINER, null, null, environmentVariables, null, version, null, customContainer);
            await this.applyDeploymentModifications(appName, deploymentName, deploymentUpdateRequestBody, createDeployment);
        } catch (error) {
            throw error;
        }
    }

    private splitCommands(input: string): string[] {
        return input.split(' ').filter(s => s != '');
    }

    public async deployWithBuildService(artifactToUpload: string, sourceType: string, appName: string, deploymentName: string, createDeployment: boolean,
        runtime?: string, jvmOptions?: string, environmentVariables?: string,
        dotNetCoreMainEntryPath?: string, version?: string, builder?: string): Promise<void> {
        tl.debug('Starting deployment with build service');
        try {
            const deploymentTarget = await this.getUploadTargetWithBuildService();
            await uploadFileToSasUrl(deploymentTarget.sasUrl, artifactToUpload);

            const triggeredBuildResult = await this.updateKPackBuild(appName, deploymentTarget.relativePath, builder);
            await this.waitBuildFinish(triggeredBuildResult);

            const deploymentUpdateRequestBody = this.prepareDeploymentUpdateRequestBody(deploymentTarget.relativePath, sourceType, runtime, jvmOptions, environmentVariables, dotNetCoreMainEntryPath, version, triggeredBuildResult, null);
            await this.applyDeploymentModifications(appName, deploymentName, deploymentUpdateRequestBody, createDeployment);
        } catch (error) {
            throw error;
        }
    }

    protected async getUploadTargetWithBuildService(): Promise<UploadTarget> {
        tl.debug('Obtaining upload target with build service');

        const buildServiceName = 'default'
        const requestUri = this._client.getRequestUri(`${this._resourceId}/buildServices/{buildServiceName}/getResourceUploadUrl`, {
            '{buildServiceName}': buildServiceName
        }, null, API_VERSION);

        const response = await this.sendRequest('POST', requestUri, null);

        if (response.statusCode != 200) {
            console.error('Error code: ' + response.statusCode);
            console.error(response.statusMessage);
            throw ToError(response);
        }

        return new UploadTarget(response.body.uploadUrl, response.body.relativePath);
    }

    private async updateKPackBuild(appName: string, relativePath: string, builder?: string) {
        tl.debug('Updating KPack build');

        // Prepare request uri
        const buildServiceName = 'default';
        const requestUri = this._client.getRequestUri(`${this._resourceId}/buildServices/{buildServiceName}/builds/{buildName}`, {
            '{buildServiceName}': buildServiceName,
            '{buildName}': appName
        }, null, API_VERSION);
        // Prepare request body (parameter name - build)
        const requestBody = {
            properties: {
                relativePath: relativePath,
                builder: builder ? builder : `${this._resourceId}/buildServices/${buildServiceName}/builders/default`,
                agentPool: `${this._resourceId}/buildServices/default/agentPools/default`
            }
        };

        // Send the request
        try {
            const response = await this.sendRequest('PUT', requestUri, JSON.stringify(requestBody));
            if (response.statusCode == 200 || response.statusCode == 201) {
                tl.debug('Found KPack build result id');
                return response.body.properties.triggeredBuildResult.id;
            } else {
                tl.debug('Error when updating KPack build');
                throw ToError(response);
            }
        } catch (error) {
            tl.debug('Error when sending updating KPack build request');
            throw(error);
        }
    }

    private async waitBuildFinish(triggeredBuildResult: string) {
        tl.debug('Waiting for building docker image to finish');

        // Build request
        const request = "https://management.azure.com" + triggeredBuildResult + "?api-version=" + API_VERSION;

        var provisioningState = 'Building';
        var response: webClient.WebResponse;

        // A potentially infinite loop
        while (provisioningState != 'Succeeded') {
            // Sleep for a 5 seconds
            await new Promise(r => setTimeout(r, 1500));
            // Get build status
            try {
                response = await this.sendRequest('GET', request);
                if (response.statusCode != 200) {
                    tl.debug('Get KPack build result failed');
                    throw ToError(response);
                }
                provisioningState = response.body.properties.provisioningState;
            } catch (error) {
                throw error;
            }
        }
    }

    public async setActiveDeployment(appName: string, deploymentName: string) {
        console.log(`Setting active deployment on app ${appName} to ${deploymentName}`);

        const requestUri = this._client.getRequestUri(`${this._resourceId}/apps/{appName}/setActiveDeployments`, {
            '{appName}': appName,
        }, null, API_VERSION);
        const requestBody = JSON.stringify(
            {
                activeDeploymentNames: [
                    deploymentName
                ]
            }
        );

        const response = await this.sendRequest('POST', requestUri, requestBody);

        console.log('Response:');
        console.log(response.body);

        let expectedStatusCodes: number[] = [200, 202];
        if (!expectedStatusCodes.includes(response.statusCode)) {
            tl.error('Error code: ' + response.statusCode);
            tl.error(response.statusMessage);
            throw Error(response.statusCode + ":" + response.statusMessage);
        } else {
            tl.debug('App update initiated.');
            //If the operation is asynchronous, block pending its conclusion.
            var operationStatusUrl = response.headers[LOCATION_HEADER];
            if (operationStatusUrl) {
                tl.debug('Awaiting operation completion.');
                try {
                    await this.awaitOperationCompletion(operationStatusUrl);
                } catch (error) {
                    tl.debug('Error in awaiting operation completion');
                    throw error;
                }
            } else {
                tl.debug('Received async status code with no async operation. Headers: ');
                tl.debug(JSON.stringify(response.headers));
            }
        }
    }

    protected async getAllDeploymentInfo(appName: String): Promise<Object> {
        tl.debug(`Finding deployments for app ${appName}`)
        const requestUri = this._client.getRequestUri(`${this._resourceId}/apps/{appName}/deployments`, {
            '{appName}': appName
        }, null, API_VERSION);

        try {
            const response = await this.sendRequest('GET', requestUri);
            if (response.statusCode == 404) {
                tl.debug('404 when querying deployment names');
                throw Error(tl.loc('NoDeploymentsExist'));
            } if (response.statusCode != 200) {
                tl.error(`${tl.loc('UnableToGetDeploymentInformation')} ${tl.loc('StatusCode')}: ${response.statusCode}`);
                throw ToError(response);
            } else {
                tl.debug('Found deployments.');
                return response.body;
            }
        } catch (error) {
            throw (error);
        }
    }

    /**
     * Returns the currently inactive deployment, or `undefined` if none exists.
     * @param appName 
     */
    public async getInactiveDeploymentName(appName: string): Promise<string> {
        const allDeploymentsData = await this.getAllDeploymentInfo(appName);
        const inactiveDeploymentName = jsonPath.eval(allDeploymentsData, '$.value[?(@.properties.active == false)].name')[0];
        tl.debug(`Inactive deployment name: ${inactiveDeploymentName}`);
        return inactiveDeploymentName;
    }

    /**
     * Returns all deployment names for an app.
     * @param appName 
     */
    public async getAllDeploymentNames(appName: string): Promise<string[]> {
        const allDeploymentsData = await this.getAllDeploymentInfo(appName);
        const deploymentNames = jsonPath.eval(allDeploymentsData, '$.value[*].name')
        tl.debug('Found deployment names: ' + deploymentNames);
        return deploymentNames;
    }

    protected async getServiceInfo(): Promise<Object> {
        tl.debug('Obtaining the current service and its properties');
        const requestUri = this._client.getRequestUri(`${this._resourceId}`, {}, null, API_VERSION);

        try {
            const response = await this.sendRequest('GET', requestUri);
            if (response.statusCode == 200) {
                tl.debug("Service information obtained");
                return response.body;
            } else {
                tl.error(`${tl.loc('UnableToGetServiceInformation')} ${tl.loc('StatusCode')}: ${response.statusCode}`);
                throw ToError(response);
            }
        } catch (error) {
            throw(error);
        }
    }

    /**
     * Returns the sku of the service
     */
    public async getServiceSkuTier(): Promise<String> {
        const serviceInfo = await this.getServiceInfo();

        const getServiceSkuTier = jsonPath.eval(serviceInfo, '$.sku.tier');
        tl.debug("Service sku obtained");
        return getServiceSkuTier;
    }

    protected async getUploadTarget(appName: string): Promise<UploadTarget> {
        tl.debug('Obtaining upload target.');

        const requestUri = this._client.getRequestUri(`${this._resourceId}/apps/{appName}/getResourceUploadUrl`, {
            '{appName}': appName
        }, null, API_VERSION);

        const response = await this.sendRequest('POST', requestUri, null);

        if (response.statusCode != 200) {
            console.error('Error code: ' + response.statusCode);
            console.error(response.statusMessage);
            throw ToError(response);
        }
        return new UploadTarget(response.body.uploadUrl, response.body.relativePath);
    }

    /**
     * Prepares a body for a deployment update request.
     */
    private prepareDeploymentUpdateRequestBody(resourcePath: string, sourceType: string,
        runtime?: string, jvmOptions?: string, environmentVariables?: string, dotNetCoreMainEntryPath?: string, version?: string,
        buildResultId?: string, customContainer?: CustomContainer) {

        //Populate optional deployment settings
        var deploymentSettings = {};

        if (runtime) {
            deploymentSettings['runtimeVersion'] = runtime;
        }
        if (jvmOptions) {
            tl.debug("JVM Options modified.");
            deploymentSettings['jvmOptions'] = jvmOptions;
        }
        if (dotNetCoreMainEntryPath) {
            tl.debug('.Net Core Entry path specified');
            deploymentSettings['netCoreMainEntryPath'] = dotNetCoreMainEntryPath;
        }
        if (environmentVariables) {
            tl.debug("Environment variables modified.");
            const parsedEnvVariables = parse(environmentVariables);

            //Parsed pairs come back as  {"key1":{"value":"val1"},"key2":{"value":"val     2"}}
            var transformedEnvironmentVariables = {};
            Object.keys(parsedEnvVariables).forEach(key => {
                transformedEnvironmentVariables[key] = parsedEnvVariables[key]['value'];
            });
            tl.debug('Environment Variables: ' + JSON.stringify(transformedEnvironmentVariables));
            deploymentSettings['environmentVariables'] = transformedEnvironmentVariables;
        }

        //Populate source settings
        var sourceSettings = {}
        if (buildResultId) {
            sourceSettings = {
                buildResultId: buildResultId,
                type: "BuildResult"
            };
        } else if (customContainer) {
            sourceSettings = {
                type: sourceType,
                customContainer: customContainer,
            };
        } else {
            sourceSettings = {
                relativePath: resourcePath,
                type: sourceType
            };
        }

        if (version) {
            sourceSettings['version'] = version;
        }

        //Build update request body
        return {
            properties: {
                source: sourceSettings,
                deploymentSettings: deploymentSettings
            }
        };
    }

    /**
     * Creates/Updates deployment settings.
     * @param appName The name of the app to create/update
     * @param deploymentName The name of the deployment to create/update
     * @param deploymentUpdateRequestBody JSON specifying all deployment properties
     * @param createDeployment Whether or not a new deployment should be created.
     */
    private async applyDeploymentModifications(appName: string, deploymentName: string, deploymentUpdateRequestBody, createDeployment: boolean) {
        console.log(`${createDeployment ? 'Creating' : 'Updating'} ${appName}, deployment ${deploymentName}...`);

        let method = createDeployment ? 'PUT' : 'PATCH';
        let requestUri = this._client.getRequestUri(`${this._resourceId}/apps/{appName}/deployments/{deploymentName}`, {
            '{appName}': appName,
            '{deploymentName}': deploymentName
        }, null, API_VERSION);

        // Send the request
        try {
            var response = await this.sendRequest(method, requestUri, JSON.stringify(deploymentUpdateRequestBody));
        } catch (error) {
            tl.debug('Error when sending app update request');
            throw (error);
        }
        console.log(JSON.stringify(response.body, null, 2));

        let expectedStatusCodes: number[] = createDeployment ? [200, 201, 202] : [200, 202];
        if (!expectedStatusCodes.includes(response.statusCode)) {
            console.error(`${tl.loc('StatusCode')}: ${response.statusCode}`);
            console.error(response.statusMessage);
            throw ToError(response);
        } else {
            tl.debug('App update initiated.')
            //If the operation is asynchronous, block pending its conclusion.
            var operationStatusUrl = response.headers[LOCATION_HEADER];
            if (operationStatusUrl) {
                tl.debug('Awaiting operation completion.');
                try {
                    await this.awaitOperationCompletion(operationStatusUrl);
                } catch (error) {
                    tl.debug('Error in awaiting operation completion');
                    throw error;
                } finally {
                    //A build log is available on the deployment when uploading a folder. Let's display it.
                    if (deploymentUpdateRequestBody.properties.source.sourceType == SourceType.SOURCE_DIRECTORY)
                        await this.printDeploymentLog(appName, deploymentName);
                }
            } else {
                tl.debug('Received async status code with no async operation. Headers: ');
                tl.debug(JSON.stringify(response.headers));
            }
        }
    }

    /**
     * Obtains the build/deployment log for a deployment and prints it to the console.
     * @param appName 
     * @param deploymentName 
     */
    async printDeploymentLog(appName: string, deploymentName: string) {

        let logUrlRequestUri = this._client.getRequestUri(this._resourceId + '/apps/{appName}/deployments/{deploymentName}/getLogFileUrl', {
            '{appName}': appName,
            '{deploymentName}': deploymentName
        }, null, API_VERSION);

        var logUrl: string;
        try {
            var logUrlResponse = await this.sendRequest('POST', logUrlRequestUri);
            var logUrlResponseBody = logUrlResponse.body;
            logUrl = logUrlResponseBody.url;
        } catch (error) {
            tl.warning('Unable to get deployment log URL: ' + error);
            return;
        }

        //Can't use the regular client as the presence of an Authorization header results in errors.
        https.get(logUrl, response => {
            var downloadedLog = '';
            //another chunk of data has been received, so append it to `str`
            response.on('data', function (chunk) {
                downloadedLog += chunk;
            });

            //the whole response has been received, so we just print it out here
            response.on('end', function () {
                console.log('========================================================');
                console.log('            ' + tl.loc('DeploymentLog'));
                console.log('========================================================');
                console.log(downloadedLog);
            });
        }).end();
    }

    /**
     * Awaits the completion of an operation marked by a return of status code 200 from the status URL.
     * @param operationStatusUrl The status URL of the Azure operation
     */
    async awaitOperationCompletion(operationStatusUrl: string) {


        tl.debug('Checking operation status at ' + operationStatusUrl);
        var statusCode = 202;
        var message = '';
        var response: webClient.WebResponse;

        //A potentially infinite loop, but tasks can have timeouts.throw (`${response.body.error.code}`)
        while (statusCode == 202) {
            //Sleep for a 5 seconds
            await new Promise(r => setTimeout(r, 5000));
            //Get status
            response = await this.sendRequest('GET', operationStatusUrl);
            statusCode = response.statusCode;
            message = response.statusMessage;
            tl.debug(`${statusCode}: ${message}`);
        }

        switch (statusCode) {
            case 202: {
                tl.error(tl.loc(('OperationTimedOut')));
                break;
            }
            case 200: {
                var responseError = response.body.error;
                if (responseError) {
                    throw Error(`${responseError.message} [${responseError.code}]`)
                }
                break;
            } default: {
                throw Error(tl.loc('OperationFailed', statusCode, message));
            }
        }

    }

    /**
     * Deletes a deployment of the app.
     * @param appName 
     * @param deploymentName 
     */
    public async deleteDeployment(appName: string, deploymentName: string) {
        console.log(`Deleting deployment ${deploymentName} from app ${appName}`);

        let requestUri = this._client.getRequestUri(`${this._resourceId}/apps/{appName}/deployments/{deploymentName}`, {
            '{appName}': appName,
            '{deploymentName}': deploymentName
        }, null, API_VERSION);

        // Send the request
        try {
            var response = await this.sendRequest('DELETE', requestUri);
        } catch (error) {
            tl.debug('Error when sending deleting deployment request');
            throw (error);
        }

        let expectedStatusCodes = [200, 202];
        if (!expectedStatusCodes.includes(response.statusCode)) {
            console.error(`${tl.loc('UnableToDeleteDeployment')} ${tl.loc('StatusCode')}: ${response.statusCode}`);
            console.error(response.statusMessage);
            throw Error(tl.loc('UnableToDeleteDeployment'));
        } else {
            // If the operation is asynchronous, block pending its conclusion
            var operationStatusUrl = response.headers[ASYNC_OPERATION_HEADER];
            if (operationStatusUrl) {
                tl.debug("Awaiting deleting operation completion");
                try {
                    await this.awaitOperationCompletion(operationStatusUrl);
                } catch (error) {
                    tl.debug("Error in awaiting deleting deployment completion");
                }
            }
        }
    }

    /**
     * Retrieves the private test endpoint(s) for the deployment.
     * Returns null if private endpoint is disabled.
     */
    public async getTestEndpoint(appName: string, deploymentName: string): Promise<string> {
        tl.debug(`Retrieving private endpoint for deployment ${deploymentName} from app ${appName}`);

        let requestUri = this._client.getRequestUri(`${this._resourceId}/listTestKeys`, {}, null, API_VERSION);
        try {
            var response: webClient.WebResponse = await this.sendRequest('POST', requestUri);
            if (!response.body.enabled) {
                tl.warning(tl.loc('PrivateTestEndpointNotEnabled'));
                return null;
            } else {
                tl.debug('Private endpoint returned.');
                return `${response.body.primaryTestEndpoint}/${encodeURIComponent(appName)}/${encodeURIComponent(deploymentName)}`
            }
        } catch (error) {
            tl.error(tl.loc('UnableToRetrieveTestEndpointKeys'));
            throw (error);
        }
    }
}
