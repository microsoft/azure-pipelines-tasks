import webClient = require('./webClient');
import tl = require('vsts-task-lib/task');
import Q = require('q');

export class KuduService {
    private scmUri: string;
    private userName: string;
    private password: string;
    private accessToken: string;
    
    constructor(scmUri: string, userName: string, password: string) {
        this.scmUri = scmUri;
        this.userName = userName;
        tl.setVariable('KUDU_SCM_USERNAME', userName, true);
        this.password = password;
        tl.setVariable('KUDU_SCM_PASSWORD', password, true);
        var userNamePasswordbase64 = new Buffer(userName + ':' + password).toString('base64');
        this.accessToken = `Basic ${userNamePasswordbase64}`;
    }

    /**
     * List all continuous jobs
     * 
     * https://github.com/projectkudu/kudu/wiki/WebJobs-API#list-all-continuous-jobs
     */
    public async getContinuousWebJobs(): Promise<WebJob[]> {
        let dataDeferred = Q.defer<WebJob[]>();
        let webRequest = new webClient.WebRequest();
        webRequest.method = 'GET';
        webRequest.uri = `${this.scmUri}/api/continuouswebjobs`;
        webRequest.headers = {
            'authorization': this.accessToken
        }

        webClient.sendRequest(webRequest).then((response) => {
            if(response.statusCode == 200) {
                dataDeferred.resolve(response.body as WebJob[]);
            }
            else {
                dataDeferred.reject(JSON.stringify(response));
            }
        }, (error) => {
            dataDeferred.reject(error);
        })
        return dataDeferred.promise;
    }

    /**
     * Start a continous WebJob
     * 
     * https://github.com/projectkudu/kudu/wiki/WebJobs-API#start-a-continuous-job
     */
    public async startContinuousJob(webJobName: string) {
        let dataDeferred = Q.defer<any>();
        let webRequest = new webClient.WebRequest();
        webRequest.method = 'POST';
        webRequest.uri = `${this.scmUri}/api/continuouswebjobs/${webJobName}/start`;
        webRequest.headers = {
            'authorization': this.accessToken
        }

        webClient.sendRequest(webRequest).then((response) => {
            if(response.statusCode == 200) {
                dataDeferred.resolve(response.body);
            }
            else {
                dataDeferred.reject(JSON.stringify(response));
            }
        }, (error) => {
            dataDeferred.reject(error);
        });     

        return dataDeferred.promise;
    }

    /**
     * Stop a continous WebJob
     * 
     * https://github.com/projectkudu/kudu/wiki/WebJobs-API#stop-a-continuous-job
     */
    public async stopContinuousJob(webJobName: string) {
        let dataDeferred = Q.defer<any>();
        let webRequest = new webClient.WebRequest();
        webRequest.method = 'POST';
        webRequest.uri = `${this.scmUri}/api/continuouswebjobs/${webJobName}/stop`;
        webRequest.headers = {
            'authorization': this.accessToken
        }

        webClient.sendRequest(webRequest).then((response) => {
            if(response.statusCode == 200) {
                dataDeferred.resolve(response.body);
            }
            else {
                dataDeferred.reject(JSON.stringify(response));
            }
        }, (error) => {
            dataDeferred.reject(error);
        });     

        return dataDeferred.promise;
    }

    /**
     * Creates folder(s) from given relative path
     * @param path physical path (say: /site/wwwroot)
     */
    public async createPath(path: string) {
        let dataDeferred = Q.defer<any>();
        let webRequest = new webClient.WebRequest();
        webRequest.method = 'PUT';
        webRequest.uri = `${this.scmUri}/api/vfs/${path}`;
        webRequest.headers = {
            'authorization': this.accessToken,
            'If-Match': '*'
        }

        webClient.sendRequest(webRequest).then((response) => {
            // 200 - OK, 201 - Created, 204 - No Content (if path already exists)
            if([200, 201, 204].indexOf(response.statusCode)) {
                dataDeferred.resolve(response);
            }
            else {
                dataDeferred.reject(JSON.stringify(response));
            }
        }, (error) => {
            dataDeferred.reject(error);
        });

        return dataDeferred.promise;
    }

    public async getExtensions() {
        var dataDeferred = Q.defer<any>();
        let webRequest = new webClient.WebRequest();
        webRequest.method = 'GET';
        webRequest.uri = `${this.scmUri}/api/extensions`;
        webRequest.headers = {
            'authorization': this.accessToken,
            'If-Match': '*'
        }

        webClient.sendRequest(webRequest).then((response) => {
            if(response.statusCode == 200) {
                var extensions = response.body;
                var installedExtensionsList = {};
                for(var extension of extensions) {
                    tl.debug('* ' + extension['id']);
                    installedExtensionsList[extension['id']] = extension;
                }

                dataDeferred.resolve(installedExtensionsList);
            }
            else {
                dataDeferred.reject(JSON.stringify(response));
            }
        }, (error) => {
            dataDeferred.reject(error.toString());
        })
        return dataDeferred.promise;
    }

    public async installExtension(extension: string) {
        var dataDeferred = Q.defer<any>();
        let webRequest = new webClient.WebRequest();
        webRequest.method = 'PUT';
        webRequest.uri = `${this.scmUri}/api/extensions/${extension}`;
        webRequest.headers = {
            'authorization': this.accessToken,
            'If-Match': '*'
        }

        webClient.sendRequest(webRequest).then((response) => {
            if(response.statusCode == 200) {
                var extensionData = response.body;
                dataDeferred.resolve(extensionData);
            }
            else {
                dataDeferred.reject(extension);
            }
        }, (error) => {
            dataDeferred.reject(error.toString());
        })
        return dataDeferred.promise;
    }

    public async installExtensions(extensions: Array<string>, outputVariables?: Array<string>) {
        var outputVariableCount = 0;
        var outputVariableSize = outputVariables ? outputVariables.length : 0;
        var InstalledExtensions = await this.getExtensions();
        var extensionInfo = null;
        var anyExtensionInstalled = false;
        for(var extension of extensions) {
            extension = extension.trim();
            if(InstalledExtensions[extension]) {
                extensionInfo = InstalledExtensions[extension];
                console.log(tl.loc('ExtensionAlreadyAvaiable', extensionInfo['title']));
            }
            else {
                tl.debug("Extension '" + extension + "' not installed. Installing...");
                extensionInfo = await this.installExtension(extension);
                anyExtensionInstalled = true;
            }
            if(outputVariableCount < outputVariableSize) {
                var extensionLocalPath: string = this._getExtensionLocalPath(extensionInfo);
                tl.debug('Set Variable ' + outputVariables[outputVariableCount] + ' to value: ' + extensionLocalPath);
                tl.setVariable(outputVariables[outputVariableCount], extensionLocalPath);
                outputVariableCount += 1;
            }
        }

        return anyExtensionInstalled;
    }

    public generateDeploymentId(): string {
        var buildUrl = tl.getVariable('build.buildUri');
        var releaseUrl = tl.getVariable('release.releaseUri');
    
        var buildId = tl.getVariable('build.buildId');
        var releaseId = tl.getVariable('release.releaseId');
    
        if(releaseUrl !== undefined) {
            return releaseId + Date.now();
        }
        else if(buildUrl !== undefined) {
            return buildId + Date.now();
        }
        else {
            throw new Error(tl.loc('CannotupdatedeploymentstatusuniquedeploymentIdCannotBeRetrieved'));
        }
    }

    public updateDeploymentStatus(isDeploymentSuccess: boolean, deploymentID?: string, customMessage?: any) {
        let dataDeferred = Q.defer<any>();
        deploymentID = deploymentID ? deploymentID : this.generateDeploymentId();
        var requestBody = this.getUpdateHistoryRequest(isDeploymentSuccess, customMessage);
        var webRequest = new webClient.WebRequest();
        webRequest.method = 'PUT';
        webRequest.uri = `${this.scmUri}/api/deployments/${encodeURIComponent(deploymentID)}`;
        webRequest.body = JSON.stringify(requestBody);
        webClient.sendRequest(webRequest).then((response) => {
            if(response.statusCode == 200) {
                dataDeferred.resolve(response);
            }
            else {
                dataDeferred.reject(JSON.stringify(response));
            }
        }, (error) => {
            dataDeferred.reject(error);
        })
        return dataDeferred.promise;
    }

    private _getExtensionLocalPath(extensionInfo: JSON): string {
        var extensionId: string = extensionInfo['id'];
        var homeDir = "D:\\home\\";
    
        if(extensionId.startsWith('python2')) {
            return homeDir + "Python27";
        }
        else if(extensionId.startsWith('python351') || extensionId.startsWith('python352')) {
            return homeDir + "Python35";
        }
        else if(extensionId.startsWith('python3')) {
            return homeDir + extensionId;
        }
        else {
            return extensionInfo['local_path'];
        }
    }

    private getUpdateHistoryRequest(isDeploymentSuccess: boolean, customMessage: any): any {
        
        var status = isDeploymentSuccess ? 4 : 3;
        var status_text = (status == 4) ? "success" : "failed";
        var author = this.getDeploymentAuthor();
    
        var buildUrl = tl.getVariable('build.buildUri');
        var releaseUrl = tl.getVariable('release.releaseUri');
    
        var buildId = tl.getVariable('build.buildId');
        var releaseId = tl.getVariable('release.releaseId');
        
        var buildNumber = tl.getVariable('build.buildNumber');
        var releaseName = tl.getVariable('release.releaseName');
    
        var collectionUrl = tl.getVariable('system.TeamFoundationCollectionUri'); 
        var teamProject = tl.getVariable('system.teamProjectId');
    
         var commitId = tl.getVariable('build.sourceVersion');
         var repoName = tl.getVariable('build.repository.name');
         var repoProvider = tl.getVariable('build.repository.provider');
    
        var buildOrReleaseUrl = "" ;
    
        if(releaseUrl !== undefined) {
            buildOrReleaseUrl = collectionUrl + teamProject + "/_apps/hub/ms.vss-releaseManagement-web.hub-explorer?releaseId=" + releaseId + "&_a=release-summary";
        }
        else if(buildUrl !== undefined) {
            buildOrReleaseUrl = collectionUrl + teamProject + "/_build?buildId=" + buildId + "&_a=summary";
        }
        else {
            throw new Error(tl.loc('CannotupdatedeploymentstatusuniquedeploymentIdCannotBeRetrieved'));
        }
    
        var message = {
            type : customMessage.type,
            commitId : commitId,
            buildId : buildId,
            releaseId : releaseId,
            buildNumber : buildNumber,
            releaseName : releaseName,
            repoProvider : repoProvider,
            repoName : repoName,
            collectionUrl : collectionUrl,
            teamProject : teamProject
        };
        // Append Custom Messages to original message
        for(var attribute in customMessage) {
            message[attribute] = customMessage[attribute];
        }
    
        var deploymentLogType: string = message['type'];
        var active: boolean = false;
        if(deploymentLogType.toLowerCase() === "deployment" && isDeploymentSuccess) {
            active = true;
        }
    
        var requestBody = {
            active : active,
            status : status,
            status_text : status_text, 
            message : JSON.stringify(message),
            author : author,
            deployer : 'VSTS',
            details : buildOrReleaseUrl
        };

        return requestBody;
    }

    private getDeploymentAuthor(): string {
        var author = tl.getVariable('build.sourceVersionAuthor');
     
        if(author === undefined) {
            author = tl.getVariable('build.requestedfor');
        }
    
        if(author === undefined) {
            author = tl.getVariable('release.requestedfor');
        }
    
        if(author === undefined) {
            author = tl.getVariable('agent.name');
        }
    
        return author;
    }
}

export interface WebJob {
    name: string;
    status: string;
    runCommand: string;
    log_url: string;
    url: string;
    type: string;
}