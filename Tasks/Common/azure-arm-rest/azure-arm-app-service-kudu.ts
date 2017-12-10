import msRestAzure = require("./azure-arm-common");
import tl = require('vsts-task-lib/task');
import util = require("util");
import webClient = require("./webClient");
import Q = require("q");
import azureServiceClient = require("./AzureServiceClient");

export class KuduServiceManagementClient {
    private _scmUri;
    private _accesssToken: string;
    public kuduService: KuduService;

    constructor(scmUri: string, accessToken: string) {
        this._accesssToken = accessToken;
        this._scmUri = scmUri;
        this.kuduService = new KuduService(this);
    }

    public async beginRequest(request: webClient.WebRequest): Promise<webClient.WebResponse> {
        request.headers = request.headers || {};
        request.headers["Authorization"] = "Basic " + this._accesssToken;
        request.headers['Content-Type'] = 'application/json; charset=utf-8';
        var httpResponse = webClient.sendRequest(request);
        return httpResponse;
    }

    public getRequestUri(uriFormat: string) {
        uriFormat = uriFormat[0] == "/" ? uriFormat : "/" + uriFormat;
        return this._scmUri + uriFormat;
    }
}

export class KuduService {
    private _client: KuduServiceManagementClient;

    constructor(client: KuduServiceManagementClient) {
        this._client = client;
    }

    public async updateDeployment(deploymentID: string, deploymentDataEntity: any, options: any, callback: azureServiceClient.ApiCallback) {
        if(!callback && typeof options === 'function') {
            callback = options;
            options = null;
        }
        
        if(!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        try {
            if(!deploymentID || typeof deploymentID.valueOf() != 'string') {
                throw new Error(tl.loc('DeploymentIDCannotBeNull'));
            }

            if(!deploymentDataEntity) {
                throw new Error(tl.loc('DeploymentDataEntityCannotBeNull'));
            }
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'PUT';
        httpRequest.body = JSON.stringify(deploymentDataEntity);
        httpRequest.uri = this._client.getRequestUri(`/api/deployments/${deploymentID}`);
        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            let deferred = Q.defer<azureServiceClient.ApiResult>();
            if(response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public async getContinuousJobs(callback: azureServiceClient.ApiCallback) {
        if(!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.uri = this._client.getRequestUri(`/api/continuouswebjobs`);
        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            let deferred = Q.defer<azureServiceClient.ApiResult>();
            if(response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public async startContinuousJob(name: string, callback: azureServiceClient.ApiCallback) {
        if(!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        try {
            if(!name) {
                throw new Error(tl.loc("JobNameCannotBeNull"));
            }
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        httpRequest.uri = this._client.getRequestUri(`/api/continuouswebjobs/${name}/start`);
        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            let deferred = Q.defer<azureServiceClient.ApiResult>();
            if(response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public async stopContinuousJob(name: string, callback: azureServiceClient.ApiCallback) {
        if(!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        try {
            if(!name) {
                throw new Error(tl.loc("JobNameCannotBeNull"));
            }
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'POST';
        httpRequest.uri = this._client.getRequestUri(`/api/continuouswebjobs/${name}/stop`);
        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            let deferred = Q.defer<azureServiceClient.ApiResult>();
            if(response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public async getSiteExtensions(callback: azureServiceClient.ApiCallback) {
        if(!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'GET';
        httpRequest.uri = this._client.getRequestUri(`/api/siteextensions`);
        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            let deferred = Q.defer<azureServiceClient.ApiResult>();
            if(response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }

    public async installSiteExtension(name: string, callback: azureServiceClient.ApiCallback) {
        if(!callback) {
            throw new Error(tl.loc("CallbackCannotBeNull"));
        }

        try {
            if(!name) {
                throw new Error(tl.loc("SiteExtensionCannotBeNull"));
            }
        }
        catch(error) {
            return callback(error);
        }

        var httpRequest = new webClient.WebRequest();
        httpRequest.method = 'PUT';
        httpRequest.uri = this._client.getRequestUri(`/api/siteextensions/${name}`);
        this._client.beginRequest(httpRequest).then((response: webClient.WebResponse) => {
            let deferred = Q.defer<azureServiceClient.ApiResult>();
            if(response.statusCode == 200) {
                deferred.resolve(new azureServiceClient.ApiResult(null, response.body));
            }
            else {
                deferred.resolve(new azureServiceClient.ApiResult(azureServiceClient.ToError(response)));
            }
            return deferred.promise;
        }).then((apiResult: azureServiceClient.ApiResult) => callback(apiResult.error, apiResult.result),
            (error) => callback(error));
    }
    
}