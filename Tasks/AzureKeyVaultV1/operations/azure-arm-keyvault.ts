import { ServiceClient } from "azure-pipelines-tasks-azure-arm-rest-v2/AzureServiceClient";
import { ToError, ApiCallback, ApiResult} from "azure-pipelines-tasks-azure-arm-rest-v2/AzureServiceClientBase";
import tl = require('azure-pipelines-task-lib/task');
import { WebRequest, WebResponse, sleepFor } from "azure-pipelines-tasks-azure-arm-rest-v2/webClient";

export class AzureKeyVaultSecret {
    name: string;
    enabled: boolean;
    expires: Date;
    contentType: string;
}

export class KeyVaultClient
{
    private readonly apiVersion = "2016-10-01";
    private readonly retriableErrorCodes = ["ETIMEDOUT", "ECONNRESET", "ENOTFOUND", "ESOCKETTIMEDOUT", "ECONNREFUSED", "EHOSTUNREACH", "EPIPE", "EA_AGAIN", "EAI_AGAIN"];
    private readonly retriableStatusCodes = [408, 409, 500, 502, 503, 504];

    constructor(private client: ServiceClient, private keyVaultUrl: string)
    {
    }

    private async invokeRequest(request: WebRequest): Promise<WebResponse>
    {
        const maxRetryCount: number = 5;
        const retryIntervalInSeconds: number = 2;

        let retryCount: number = 0;

        while (true)
        {
            try
            {
                let response = await this.client.beginRequest(request);
                if (response.statusCode == 401)
                {
                    const vaultResourceId = this.getValidVaultResourceId(response);
                    if (!!vaultResourceId)
                    {
                        console.log(tl.loc("RetryingWithVaultResourceIdFromResponse", vaultResourceId));

                        this.client.getCredentials().activeDirectoryResourceId = vaultResourceId; // update vault resource Id
                        this.client.getCredentials().getToken(true); // Refresh authorization token in cache
                        response = await this.client.beginRequest(request);
                    }
                }

                if (this.retriableStatusCodes.indexOf(response.statusCode) === -1)
                {
                    return response;
                }

                if (++retryCount >= maxRetryCount)
                {
                    return response;
                }

                tl.debug(`Encountered a retriable status code: ${response.statusCode}. Message: '${response.statusMessage}'.`);              
            }
            catch (error)
            {
                if (++retryCount >= maxRetryCount)
                {
                    throw error;
                }

                if (!this.isRetriableError(error))
                {
                    throw error;
                }

                tl.debug(`Encountered an error. Will retry. Error: ${error.code}. Message: ${error.message}.`);                
            }

            await sleepFor(retryIntervalInSeconds);
        }
    }

    private isRetriableError(error: any): boolean
    {
        if (this.retriableErrorCodes.indexOf(error.code) !== -1)
        {
            return true;
        }

        if (!error.message)
        {
            return false;
        }

        if (error.message.startsWith("Request timeout: "))
        {
            return true;
        }

        if (error.message.startsWith("getaddrinfo "))
        {
            return true;
        }

        return false;
    }

    private getValidVaultResourceId(response: WebResponse) {
        if (!!response.headers) {
            var authenticateHeader = response.headers['www-authenticate'];
            if (!!authenticateHeader) {
                var parsedParams = authenticateHeader.split(",").map(pair => pair.split("=").map(function(item) {
                    return item.trim();
                }));

                const properties = {};
                parsedParams.forEach(([key,value]) => properties[key] = value);
                if(properties['resource']) {
                    return properties['resource'].split('"').join('');
                }
            }
        }

        return null;
    }

    public getSecrets(nextLink: string, callback: ApiCallback)
    {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        // Create HTTP transport objects
        var url = nextLink;
        if (!url)
        {
            url = this.client.getRequestUriForBaseUri(
                this.keyVaultUrl,
                '/secrets',
                {},
                ['maxresults=25'],
                this.apiVersion);
        }

        var httpRequest = new WebRequest();
        httpRequest.method = 'GET';
        httpRequest.headers = {};
        httpRequest.uri = url;

        console.log(tl.loc("DownloadingSecretsUsing", url));

        this.invokeRequest(httpRequest).then(async (response: WebResponse) => {
            var result = [];
            if (response.statusCode == 200) {
                if (response.body.value) {
                    result = result.concat(response.body.value);
                }

                if (response.body.nextLink) {
                    var nextResult = await this.client.accumulateResultFromPagedResult(response.body.nextLink);
                    if (nextResult.error) {
                        return new ApiResult(nextResult.error);
                    }
                    result = result.concat(nextResult.result);

                    var listOfSecrets = this.convertToAzureKeyVaults(result);
                    return new ApiResult(null, listOfSecrets);
                }
                else {
                    var listOfSecrets = this.convertToAzureKeyVaults(result);
                    return new ApiResult(null, listOfSecrets);
                }
            }
            else {
                return new ApiResult(ToError(response));
            }
        }).then((apiResult: ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public getSecretValue(secretName: string, callback: ApiCallback)
    {
        if (!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        // Create HTTP transport objects
        var httpRequest = new WebRequest();
        httpRequest.method = 'GET';
        httpRequest.headers = {};
        httpRequest.uri = this.client.getRequestUriForBaseUri(
            this.keyVaultUrl,
            '/secrets/{secretName}',
            {
                '{secretName}': secretName
            },
            [],
            this.apiVersion
        );

        console.log(tl.loc("DownloadingSecretValue", secretName));
        this.invokeRequest(httpRequest).then(async (response: WebResponse) => {
            if (response.statusCode == 200) {
                var result = response.body.value;
                return new ApiResult(null, result);
            }
            else if (response.statusCode == 400) {
                return new ApiResult(tl.loc('GetSecretFailedBecauseOfInvalidCharacters', secretName));
            }
            else {
                return new ApiResult(ToError(response));
            }
        }).then((apiResult: ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    private convertToAzureKeyVaults(result: any[]): AzureKeyVaultSecret[] {
        var listOfSecrets: AzureKeyVaultSecret[] = [];
        result.forEach((value: any, index: number) => {
            var expires;
            if (value.attributes.exp)
            {
                expires = new Date(0);
                expires.setSeconds(parseInt(value.attributes.exp));
            }

            var secretIdentifier: string = value.id;
            var lastIndex = secretIdentifier.lastIndexOf("/");
            var name: string = secretIdentifier.substr(lastIndex + 1, secretIdentifier.length);

            var azkvSecret: AzureKeyVaultSecret = {
                name: name,
                contentType: value.contentType,
                enabled: value.attributes.enabled,
                expires: expires
            };

            listOfSecrets.push(azkvSecret);
        });

        return listOfSecrets;
    }
}