import * as Q from 'q';
import * as tl from 'vsts-task-lib/task';
import * as handlers from "artifact-engine/Providers/typed-rest-client/Handlers"

import { 
    HttpClient, 
    HttpClientResponse,
} from "artifact-engine/Providers/typed-rest-client/HttpClient";

import { IRequestOptions as IHttpRequestOptions } from "artifact-engine/Providers/typed-rest-client/Interfaces";

var handlebars = require('handlebars');

export class JenkinsJobDetails {
    jobName: string;
    buildId: number;
    jobType: string;
    isMultiBranchPipeline: boolean;
    multiBranchPipelineName: string;
    jobUrlInfix: string;
    multiBranchPipelineUrlInfix: string;

    constructor(jobName: string, buildId: number, jenkinsJobType?: string, multibranchPipelineName?: string) {
        if (isNaN(buildId)) {
            throw new Error(tl.loc("InvalidBuildId", buildId));
        }

        if (!jobName || jobName.trim().length < 1) {
            throw new Error(tl.loc("InvalidJobName", jobName))
        }

        this.jobName = jobName;
        this.jobUrlInfix = JenkinsJobDetails.GetJobUrlInfix(this.jobName)
        
        this.buildId = buildId;
        this.jobType = jenkinsJobType;
        this.multiBranchPipelineName = multibranchPipelineName;

        this.isMultiBranchPipeline = this.jobType.toLowerCase() === JenkinsJobTypes.MultiBranchPipeline.toLowerCase();
        this.multiBranchPipelineUrlInfix = this.isMultiBranchPipeline ? `/job/${this.multiBranchPipelineName}` : "";
    }

    public static GetJobUrlInfix(jenkinsJobName: string): string {
        jenkinsJobName = jenkinsJobName.replace(/\/$/, '').replace(/^\//, '');
        let result: string = "";

        jenkinsJobName.split('/').forEach((token: string) => {
            if (!!token && token.length > 0) {
                result = `${result}/job/${token}`
            }
        });

        return result;
    }
}

export class JenkinsJobTypes {
    public static Folder: string = "com.cloudbees.hudson.plugins.folder.Folder";
    public static MultiBranchPipeline: string = "org.jenkinsci.plugins.workflow.multibranch.WorkflowMultiBranchProject";
}

export class JenkinsRestClient {
    constructor() {
        this.RegisterCustomerHandleBars();
    }

    public RegisterCustomerHandleBars(): void {
        handlebars.registerHelper('caseIgnoreEqual', function(lhs, rhs, options) {
            if (!lhs && !rhs) {
                return options.fn(this);
            }

            if ((lhs && !rhs) || (!lhs && rhs)) {
                return options.inverse(this);
            }
            
            if (lhs.toUpperCase() != rhs.toUpperCase()) {
                return options.inverse(this);                    
            }
            else {
                return options.fn(this);
            }
        });

        handlebars.registerHelper('lookupAction', function(list, key, options) {
            if (!!list) {
                for (let i = 0, len = list.length; i < len; i++) {
                    if (list[i][key]) {
                        return list[i];
                    }
                }
            }

            return null;
        });

        handlebars.registerHelper('first', function(array) {
            if (!!array) {
                return array[0];
            }

            return '';
        });

        handlebars.registerHelper('pluck', function(array, key) {
            if (!!array) {
                var result = [];
                for (var i = 0; i < array.length; i++) {
                    var value = array[i][key];
                    if (!!value) {
                        result.push(value);
                    }
                }

                return result;
            }

            return [];
        });

        handlebars.registerHelper('containsInArray', function(array, value, options) {
            if (!!array) {
                for(let i = 0, len = array.length; i < len; i++) {
                    tl.debug(`checking ${array[i]} ${value}`);
                    if (!!array[i] && array[i].indexOf(value) > -1) {
                        return options.fn(this);
                    }
                }
            }

            return options.inverse(this);
        });

        handlebars.registerHelper('chopTrailingSlash', function(value, options) {
            var result: any = value;
            if (!!value && value.substr(-1) === '/') {
                result = value.substr(0, value.length - 1)
            }

            return result;
        });

        handlebars.registerHelper('selectMaxOf', function(array, property) {
            
            function GetJsonProperty(jsonObject: any, property: string): any {
                let properties = property.split('.'); // if property has dot in it, we want to access the nested property of the objects.
                let element = jsonObject;
                let found: boolean = false;
                for(let propertyIndex = 0; propertyIndex < properties.length; propertyIndex++) {
                    if (!!element) {
                        element = element[properties[propertyIndex]];

                        if (!!element && propertyIndex + 1 === properties.length) {
                            found = true;
                        }
                    }
                }

                return found == true ? element: null;
            }

            let result = null;
            if (!!array && !!property) {
                let maxValue: number = parseInt(GetJsonProperty(array[0], property));

                if (!isNaN(maxValue)) {
                    result = array[0]; //consider first as result until we figure out if there are any other max available

                    for(let i = 1; i < array.length; i++) {
                        let value: number = parseInt(GetJsonProperty(array[i], property));
                        tl.debug(`#selectMaxOf comparing values ${maxValue} and ${value}`);
                        if (!isNaN(value) && value > maxValue) {
                            result = array[i];
                            maxValue = value;
                        }                        
                    }

                    tl.debug(`Found maxvalue ${maxValue}`);
                }
            }

            return result;
        });
    }

    private GetClient(): HttpClient {
        tl.debug(`Creating http client`);

        const endpoint = tl.getInput("serverEndpoint", true);
        const strictSSL: boolean = ('true' !== tl.getEndpointDataParameter(endpoint, 'acceptUntrustedCerts', true));

        let requestOptions: IHttpRequestOptions = {
            ignoreSslError: !strictSSL
        };

        let proxyUrl: string = tl.getVariable("agent.proxyurl");
        if (!!proxyUrl) {
            requestOptions.proxy = tl.getHttpProxyConfiguration();
        }

        const username = tl.getEndpointAuthorizationParameter(endpoint, 'username', false);
        const password = tl.getEndpointAuthorizationParameter(endpoint, 'password', false);
        var handler = new handlers.BasicCredentialHandler(username, password);

        return new HttpClient("JenkinsRestClient", [handler], requestOptions);
    }

    public DownloadJsonContent(urlPath: string, handlebarSource: string, additionalHandlebarContext: { [key: string]: any }): Q.Promise<any> {
        let defer = Q.defer<any>();

        const endpoint = tl.getInput("serverEndpoint", true);
        const endpointUrl = tl.getEndpointUrl(endpoint, false);
        const jobName = tl.getInput("jobName", true);
        const strictSSL: boolean = ('true' !== tl.getEndpointDataParameter(endpoint, 'acceptUntrustedCerts', true));
        const jobUrlInfix = JenkinsJobDetails.GetJobUrlInfix(jobName);
        
        const retryLimitValue: string = tl.getVariable("VSTS_HTTP_RETRY");
        const retryLimit: number = (!!retryLimitValue && !isNaN(parseInt(retryLimitValue))) ? parseInt(retryLimitValue) : 4;
        tl.debug(`RetryLimit set to ${retryLimit}`);

        let requestUrl: string = `${endpointUrl}${jobUrlInfix}/${urlPath}`;
        console.log(tl.loc("DownloadingContentFromJenkinsServer", requestUrl, strictSSL));

        let httpClient: HttpClient = this.GetClient();
        this.ExecuteWithRetries("DownloadJsonContent", () => this.DownloadJsonContentWithRetries(httpClient, requestUrl, handlebarSource, additionalHandlebarContext), retryLimit).then((result) => {
            defer.resolve(result);
        },(err) => {
            defer.reject(err);
        });

        return defer.promise;
    }

    public DownloadJsonContentWithRetries(httpClient: HttpClient, requestUrl: string, handlebarSource: string, additionalHandlebarContext: { [key: string]: any }, ): Q.Promise<any> {    
        let defer = Q.defer<any>();

        httpClient.get(requestUrl).then((response: HttpClientResponse) => {
            response.readBody().then((body: string) => {
                if (!!body && response.message.statusCode === 200)  {
                    tl.debug(`Content received from server ${body}`);
                    let jsonResult;

                    try {
                        jsonResult = JSON.parse(body);
                    } catch(error) {
                        jsonResult = "";
                        defer.reject(error);
                    }

                    if (jsonResult != "") {
                        if (!handlebarSource) {
                            defer.resolve(jsonResult);
                        }
                        else {
                            try {
                                tl.debug(`Applying the handlebar source ${handlebarSource} on the result`);
                                let template = handlebars.compile(handlebarSource);
                                if (additionalHandlebarContext) {
                                    for (let key in additionalHandlebarContext) {
                                        tl.debug(`Adding additional context {${key} --> ${additionalHandlebarContext[key]}} to the original context`)
                                            jsonResult[key] = additionalHandlebarContext[key];
                                        };
                                }

                                var result = template(jsonResult);

                                // back slash is an illegal character in json.
                                // when we downloaded the api output has \\, but the previous parse method will strip of a single \. Adding it back.
                                result = result.replace(/\\/g,"\\\\");
                                defer.resolve(result);
                            }
                            catch(err) {
                                defer.reject(new Error(tl.loc("JenkinsArtifactDetailsParsingError", err)))
                            }
                        }
                    }
                }
                else {
                    if (response.message.statusCode) {
                        console.log(tl.loc('ServerCallErrorCode', response.message.statusCode));
                    }

                    if (body) {
                        tl.debug(body);
                    }

                    defer.reject(new Error(tl.loc('ServerCallFailed')));
                }
            }, (err) => {
                defer.reject(err);
            });
        }, (err) => {
            defer.reject(err);
        });

        return defer.promise;
    }

    public GetJobType(): Q.Promise<string> {
        let defer = Q.defer<string>();
        const jobTypeApiUrlSuffix: string = "/api/json";
        const handlerbarSource = "{{_class}}";
        tl.debug("Trying to get job type");

        this.DownloadJsonContent(jobTypeApiUrlSuffix, handlerbarSource, null).then((result) => {
            console.log(tl.loc("FoundJobType", result));
            defer.resolve(result.trim());
        }, (error) => {
            console.log(tl.loc("CannotFindJobType"));
            defer.resolve("");
        });

        return defer.promise;
    }

    public GetJobDetails(): Q.Promise<JenkinsJobDetails> {
        const jenkinsBuild: string = tl.getInput('jenkinsBuild', true);
        if (jenkinsBuild === 'LastSuccessfulBuild') {
            return this.GetLastSuccessfulBuild();
        } else {
            let defer = Q.defer<JenkinsJobDetails>();
            const jobName: string = tl.getInput('jobName', true);
            let jobType: string = "";
            let buildIdStr: string = tl.getInput('jenkinsBuildNumber');
            let branchName: string;

            this.GetJobType().then((result: string) => {
                jobType = result;
            }).fin(() => {

                let isMultibranchPipeline = jobType.toLowerCase() === JenkinsJobTypes.MultiBranchPipeline.toLowerCase();

                tl.debug(`Found Jenkins Job type ${jobType} and isMultibranchPipeline ${isMultibranchPipeline}`);
                // if its multibranch pipeline extract the branch name and buildId from the buildNumber input
                if (isMultibranchPipeline && !!buildIdStr && buildIdStr.indexOf(JenkinsRestClient.JenkinsBranchPathSeparator) != -1) {
                    tl.debug(`Extracting branchName and buildId from selected version`);
                    let position: number = buildIdStr.indexOf(JenkinsRestClient.JenkinsBranchPathSeparator);
                    branchName = buildIdStr.substring(0, position);
                    buildIdStr = buildIdStr.substring(position + 1);
                }

                const buildId = parseInt(buildIdStr);
                if (!this.IsValidBuildId(buildId, branchName, isMultibranchPipeline)) {
                    defer.reject(new Error(tl.loc("InvalidBuildId", buildIdStr)));
                }
                else {
                    let jobDetail = new JenkinsJobDetails(jobName, buildId, jobType, branchName);
                    tl.debug(`Found Jenkins job details jobName:${jobDetail.jobName}, jobType:${jobDetail.jobType}, buildId:${jobDetail.buildId}, IsMultiBranchPipeline:${jobDetail.isMultiBranchPipeline}, MultiBranchPipelineName:${jobDetail.multiBranchPipelineName}`);
                    defer.resolve(jobDetail);
                }
            });

            return defer.promise;
        }
    }

    public GetLastSuccessfulBuild(): Q.Promise<JenkinsJobDetails> {
        let defer = Q.defer<JenkinsJobDetails>();
        let jobType: string = "";
        const jobName: string = tl.getInput('jobName', true);

        this.GetJobType().then((result: string) => {
            jobType = result;
        }).fin(() => {

            let jenkinsTreeParameter = "lastSuccessfulBuild[id,displayname]";
            let handlerbarSource = "{{lastSuccessfulBuild.id}}";
            const isMultibranchPipeline = jobType.toLowerCase() === JenkinsJobTypes.MultiBranchPipeline.toLowerCase();

            tl.debug(`Found Jenkins Job type ${jobType} and isMultibranchPipeline ${isMultibranchPipeline}`);
            if (isMultibranchPipeline) {
                jenkinsTreeParameter = "jobs[name,lastSuccessfulBuild[id,displayName,timestamp]]"
                handlerbarSource = "{{#with (selectMaxOf jobs 'lastSuccessfulBuild.timestamp') as |job|}}{ \"branchName\": \"{{job.name}}\", \"buildId\": \"{{job.lastSuccessfulBuild.id}}\" }{{/with}}"
            }

            const lastSuccessfulUrlSuffix: string = `/api/json?tree=${jenkinsTreeParameter}`;
            this.DownloadJsonContent(lastSuccessfulUrlSuffix, handlerbarSource, null).then((result) => {
                let buildId: number;
                let branchName: string;
                let succeeded: boolean = false;

                if (isMultibranchPipeline) {
                    try {
                        let jsonResult = JSON.parse(result);
                        branchName = jsonResult["branchName"];
                        buildId = parseInt(jsonResult["buildId"]);
                        tl.debug(`Found branchName: ${branchName}, buildId: ${buildId}`);
                    } catch(error) {
                        defer.reject(new Error(tl.loc("CouldNotGetLastSuccessfulBuildNumber", error)));
                    }
                }
                else {
                    buildId = parseInt(result);
                }

                if (!this.IsValidBuildId(buildId, branchName, isMultibranchPipeline)) {
                    defer.reject(new Error(tl.loc("InvalidBuildId", buildId)));
                }
                else {
                    let jobDetail = new JenkinsJobDetails(jobName, buildId, jobType, branchName);
                    tl.debug(`Found Jenkins job details jobName:${jobDetail.jobName}, jobType:${jobDetail.jobType}, buildId:${jobDetail.buildId}, IsMultiBranchPipeline:${jobDetail.isMultiBranchPipeline}, MultiBranchPipelineName:${jobDetail.multiBranchPipelineName}`);
                    defer.resolve(jobDetail);
                }

            }, (error) => {
                defer.reject(new Error(tl.loc("CouldNotGetLastSuccessfulBuildNumber", error)));
            });

        });

        console.log(tl.loc('GetArtifactsFromLastSuccessfulBuild', jobName));

        return defer.promise;
    }

    public HasAssociatedArtifacts(artifactQueryUrl: string): Q.Promise<boolean> {
        let defer = Q.defer<boolean>();
        this.GetClient().get(artifactQueryUrl).then((response: HttpClientResponse) => {
            response.readBody().then((body: string) => {
                if (!!body && response.message.statusCode === 200) {
                    let jsonResult;
                    try {
                        jsonResult = JSON.parse(body);

                        if (!!jsonResult.artifacts && jsonResult.artifacts.length > 0) {
                            defer.resolve(true);
                        }
                        else {
                            defer.resolve(false);
                        }
                    } catch (error) {
                        defer.reject(error);
                    }
                }
                else {
                    if (response.message.statusCode) {
                        console.log(tl.loc('ServerCallErrorCode', response.message.statusCode));
                    }

                    if (body) {
                        tl.debug(body);
                    }

                    defer.reject(new Error(tl.loc('ServerCallFailed')));
                }
            })
        });

        return defer.promise;
    }

    private IsValidBuildId(buildId: number, multiBranchName: string, isMultiBranch: boolean): boolean {
        if (isNaN(buildId)) {
            return false;
        }

        if (isMultiBranch) {
            // if its multibranch, valid branchname should exist
            if (!multiBranchName || multiBranchName.trim().length === 0) {
                return false;
            }
        }
        else {
            // if its not multibranch there should not be a branch name
            if (!!multiBranchName && multiBranchName.trim().length > 0) {
                return false;
            }
        }

        return true;
    }

    private ExecuteWithRetries(operationName: string, operation: () => Q.Promise<any>, retryCount): Q.Promise<any> {
        let defer = Q.defer<any>();
        this.ExecuteWithRetriesImplementation(operationName, operation, retryCount, defer);
            
        return defer.promise;
    }
    
    private ExecuteWithRetriesImplementation(operationName: string, operation: () => Q.Promise<any>, currentRetryCount, defer: Q.Deferred<any>) {
        operation().then((result) => {
            defer.resolve(result);
        }).catch((error) => {
            if (currentRetryCount <= 0) {
                tl.error(tl.loc("OperationFailed", operationName, error));
                defer.reject(error);
            }
            else {
                console.log(tl.loc('RetryingOperation', operationName, currentRetryCount));
                currentRetryCount = currentRetryCount - 1;
                setTimeout(() => this.ExecuteWithRetriesImplementation(operationName, operation, currentRetryCount, defer), 5 * 1000);
            }
        });
    }

    public static JenkinsBranchPathSeparator: string = "/";
}