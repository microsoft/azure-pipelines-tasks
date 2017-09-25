import * as Q from 'q';
import * as tl from 'vsts-task-lib/task';

var handlebars = require('handlebars');
var request = require('request');

export class JenkinsJobDetails {
    jobName: string;
    buildId: number;
    jenkinsJobType: string;
    isMultibranchPipeline: boolean;
    multibranchPipelineName: string;
    multibranchPipelineUrlInfix: string;

    constructor(jobName: string, buildId: number, jenkinsJobType?: string, multibranchPipelineName?: string) {
        this.jobName = jobName;

        if (isNaN(buildId)) {
            throw new Error(tl.loc("InvalidBuildId", buildId));
        }
        
        this.buildId = buildId;
        this.jenkinsJobType = jenkinsJobType;
        this.multibranchPipelineName = multibranchPipelineName;

        this.isMultibranchPipeline = this.jenkinsJobType.toLowerCase() === JenkinsJobTypes.MultibranchPipeline.toLowerCase();
        this.multibranchPipelineUrlInfix = this.isMultibranchPipeline ? `/job/${this.multibranchPipelineName}` : "";
    }
}

export class JenkinsJobTypes {
    public static Folder: string = "com.cloudbees.hudson.plugins.folder.Folder";
    public static MultibranchPipeline: string = "org.jenkinsci.plugins.workflow.multibranch.WorkflowMultiBranchProject";
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

    public DownloadJsonContent(urlPath: string, handlebarSource: string, additionalHandlebarContext: { [key: string]: any }): Q.Promise<any> {
        let defer = Q.defer<any>();

        const endpoint = tl.getInput("serverEndpoint", true);
        const endpointUrl = tl.getEndpointUrl(endpoint, false);
        const jobName = tl.getInput("jobName", true);
        const username = tl.getEndpointAuthorizationParameter(endpoint, 'username', true);
        const password = tl.getEndpointAuthorizationParameter(endpoint, 'password', true);
        const strictSSL: boolean = ('true' !== tl.getEndpointDataParameter(endpoint, 'acceptUntrustedCerts', true));

        let requestUrl: string = `${endpointUrl}/job/${jobName}/${urlPath}`;
        console.log(tl.loc("DownloadingContentFromJenkinsServer", requestUrl, strictSSL));

        request.get({url: requestUrl, strictSSL: strictSSL}, (err, res, body) => {
            if (res && body && res.statusCode === 200)  {
                tl.debug(`Content received from server ${body}`);
                let jsonResult = JSON.parse(body);

                if (!handlebarSource) {
                    defer.resolve(jsonResult);
                }
                else {
                    try {
                        tl.debug(`Applying the handlebar source ${handlebarSource} on the result`);
                        let template = handlebars.compile(handlebarSource);
                        if (additionalHandlebarContext) {
                            for(let key in additionalHandlebarContext) {
                                tl.debug(`Adding additional context {${key} --> ${additionalHandlebarContext[key]}} to the original context`)
                                    jsonResult[key] = additionalHandlebarContext[key];
                                };
                        }

                        var result = template(jsonResult);
                        defer.resolve(result);
                    }
                    catch(err) {
                        defer.reject(new Error(tl.loc("JenkinsArtifactDetailsParsingError", err)))
                    }
                }
            }
            else {
                if (res && res.statusCode) {
                    console.log(tl.loc('ServerCallErrorCode', res.statusCode));
                }

                if (body) {
                    tl.debug(body);
                }

                defer.reject(new Error(tl.loc('ServerCallFailed')));
            }
        }).auth(username, password, true);

        return defer.promise;
    }

    public GetJobType(): Q.Promise<string> {
        let defer = Q.defer<string>();
        let jenkinsJobType: string = tl.getInput("jenkinsJobType", false) || "";

        if (!!jenkinsJobType && jenkinsJobType.trim().length > 0) {
            // if the jenkins server is reachable its already either set by the service or in the task
            defer.resolve(jenkinsJobType.trim());
        }
        else {
            const lastSuccessfulUrlSuffix: string = "/api/json";
            const handlerbarSource = "{{_class}}";
            tl.debug("Trying to get job type");

            this.DownloadJsonContent(lastSuccessfulUrlSuffix, handlerbarSource, null).then((result) => {
                defer.resolve(result.trim());
            }, (error) => {
                tl.debug('Could not detect project type');
                defer.resolve("");
            });
        }

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

                let isMultibranchPipeline = jobType.toLowerCase() === JenkinsJobTypes.MultibranchPipeline.toLowerCase();

                tl.debug(`Found Jenkins Job type ${jobType} and isMultibranchPipeline ${isMultibranchPipeline}`);
                // if its multibranch pipeline extract the branch name and buildId from the buildNumber input
                if (isMultibranchPipeline && !!buildIdStr && buildIdStr.indexOf(JenkinsRestClient.JenkinsFolderSeperator) != -1) {
                    tl.debug(`Extracting branchname and buildId from selected version`);
                    let position: number = buildIdStr.indexOf(JenkinsRestClient.JenkinsFolderSeperator);
                    branchName = buildIdStr.substring(0, position);
                    buildIdStr = buildIdStr.substring(position + 1);
                }

                const buildId = parseInt(buildIdStr);
                if (isNaN(buildId)) {
                    defer.reject(new Error(tl.loc("InvalidBuildId", buildIdStr)));
                }
                else {
                    console.log(tl.loc("FoundJenkinsJobDetails", jobName, buildId, branchName));
                    defer.resolve(new JenkinsJobDetails(jobName, buildId, jobType, branchName));
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
            const isMultibranchPipeline = jobType.toLowerCase() === JenkinsJobTypes.MultibranchPipeline.toLowerCase();

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

                if (isNaN(buildId)) {
                    defer.reject(new Error(tl.loc("InvalidBuildId", buildId)));
                }
                else {
                    defer.resolve(new JenkinsJobDetails(jobName, buildId, jobType, branchName));
                }

            }, (error) => {
                defer.reject(new Error(tl.loc("CouldNotGetLastSuccessfulBuildNumber", error)));
            });

        });

        tl.debug(tl.loc('GetArtifactsFromLastSuccessfulBuild', jobName));

        return defer.promise;
    }

    public static JenkinsFolderSeperator: string = "/";
}