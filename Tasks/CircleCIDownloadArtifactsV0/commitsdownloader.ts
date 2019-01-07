import * as Q from 'q';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as tl from 'vsts-task-lib/task';

import * as providers from 'artifact-engine/Providers';
import { HttpClientResponse } from 'artifact-engine/Providers/typed-rest-client/HttpClient';

export class CommitsDownloader {
    private webProvider: providers.WebProvider;

    constructor(webProvider: providers.WebProvider) {
        this.webProvider = webProvider;
    }

    public DownloadFromSingleBuildAndSave(buildId: string): Q.Promise<string> {
        let defer: Q.Deferred<string> = Q.defer<string>();
        
        console.log(tl.loc("GettingCommitsFromSingleBuild", buildId));
        this.GetCommitsFromSingleBuild(buildId).then((commits: string) => {
            this.UploadCommits(commits).then(() => {
                defer.resolve(commits);
            }, (error) => {
                defer.reject(error);
            });
        }, (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    public DownloadFromBuildRangeAndSave(startBuildId: string, endBuildId: string): Q.Promise<string> {
        let defer: Q.Deferred<string> = Q.defer<string>();

        console.log(tl.loc("DownloadingCircleCIChangeBetween", startBuildId, endBuildId));
        this.GetCommits(startBuildId, endBuildId).then((commits: string) => {
            this.UploadCommits(commits).then(() => {
                defer.resolve(commits);
            }, (error) => {
                defer.reject(error);
            });
        }, (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    private GetCommitsFromSingleBuild(buildId: any): Q.Promise<string> {
        let connection = tl.getInput("connection", true);
        let definitionId = tl.getInput("definition", true);
        var endpointUrl = tl.getEndpointUrl(connection, false);
        let defer = Q.defer<string>();
        let url: string = endpointUrl + "/api/v1.1/project/"+definitionId+"/"+buildId;
        
        this.executeWithRetries("getCommitsFromSingleBuild", this.webProvider.webClient.get, 4, url, { 'Accept': 'application/json' }).then((res: HttpClientResponse) => {
            if (res && res.message.statusCode === 200) {
                res.readBody().then((body: string) => {
                    let jsonResult = JSON.parse(body);
                    let commits = [];

                    jsonResult.all_commit_details.forEach(c => {
                        let commit = {
                            "Id": c.commit,
                            "Message": c.subject,
                            "Author": {
                                "displayName": c.author_name
                            },
                            "DisplayUri": c.commit_url,
                            "Timestamp": c.author_date
                        };

                        commits.push(commit);
                    });

                    defer.resolve(JSON.stringify(commits));
                });
            }
        });

        return defer.promise;
    }

    private GetCommits(startBuildId: string, endBuildId: string): Q.Promise<string> {
        let connection = tl.getInput("connection", true);
        let definitionId = tl.getInput("definition", true);
        var endpointUrl = tl.getEndpointUrl(connection, false);
        let defer = Q.defer<string>();
        let url: string = endpointUrl + "/api/v1.1/project/"+definitionId+"/"+startBuildId;
        let commits = [];

        this.executeWithRetries("getCommits", this.webProvider.webClient.get, 4, url, { 'Accept': 'application/json' }).then((res: HttpClientResponse) => {
            if (res && res.message.statusCode === 200) {
                res.readBody().then((body: string) => {
                    let jsonResult = JSON.parse(body);
                    let branch = jsonResult.branch;

                    let buildsUrl = endpointUrl + "/api/v1.1/project/"+definitionId+"/tree/"+branch;
                    this.webProvider.webClient.get(buildsUrl, { 'Accept': 'application/json' }).then((res: HttpClientResponse) => {
                        res.readBody().then((body: string) => {
                            let builds = JSON.parse(body);
                            let commitsDict = {};
                            builds.forEach(build => {
                                if (Number(build.build_num) <= Number(endBuildId) && Number(build.build_num) >= Number(startBuildId) && build.all_commit_details[0]) {
                                    build.all_commit_details.forEach(c => {
                                        let commit = {
                                            "Id": c.commit,
                                            "Message": c.subject,
                                            "Author": {
                                                "displayName": c.author_name
                                            },
                                            "DisplayUri": c.commit_url,
                                            "Timestamp": c.author_date
                                        };
    
                                        if (!commitsDict[commit.Id]) {
                                            commits.push(commit);
                                            commitsDict[commit.Id] = true;
                                        }
                                    });
                                }
                            });
                            
                            defer.resolve(JSON.stringify(commits));
                        });

                    });
                });
            }
        });

        return defer.promise;
    }

    private UploadCommits(commits: string): Q.Promise<void> {
        let defer: Q.Deferred<void> = Q.defer<void>();1
        let commitsFilePath = path.join(os.tmpdir(), this.GetCommitsFileName());

        console.log(tl.loc("WritingCommitsTo", commitsFilePath));
        this.WriteContentToFileAndUploadAsAttachment(commits, commitsFilePath).then(() => {
            console.log(tl.loc("SuccessfullyUploadedCommitsAttachment"));
            defer.resolve(null);
        }, (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    private GetCommitsFileName(): string {
        let fileName: string = "commits.json";
        let commitfileName: string = tl.getInput("artifactDetailsFileNameSuffix", false);

        if (commitfileName) {
            fileName = `commits_${commitfileName}`;
        }

        return fileName;
    }

    private WriteContentToFileAndUploadAsAttachment(content: string, filePath: string): Q.Promise<any> {
        let defer = Q.defer<void>();

        // ensure it has .json extension
        if (path.extname(filePath) !== ".json") {
            filePath = `${filePath}.json`;
        }

        fs.writeFile(filePath, content, (err) => {
            if (err) {
                console.log(tl.loc("CouldNotWriteToFile", err));
                defer.reject(err);
                return;
            }

            console.log(tl.loc("UploadingAttachment", filePath));
            console.log(`##vso[task.uploadfile]${filePath}`);
            defer.resolve(null);
        });

        return defer.promise;
    }

    private executeWithRetries(operationName: string, operation: (string, any) => Promise<any>, retryCount, url, headers): Promise<any> {
        var executePromise = new Promise((resolve, reject) => {
            this.executeWithRetriesImplementation(operationName, operation, retryCount, url, headers, resolve, reject);
        });
    
        return executePromise;
    }
    
    private executeWithRetriesImplementation(operationName: string, operation: (string, any) => Promise<any>, currentRetryCount, url, headers, resolve, reject) {
        operation(url, headers).then((result) => {
            resolve(result);
        }).catch((error) => {
            if (currentRetryCount <= 0) {
                tl.error(tl.loc("OperationFailed", operationName, error));
                reject(error);
            }
            else {
                console.log(tl.loc('RetryingOperation', operationName, currentRetryCount));
                currentRetryCount = currentRetryCount - 1;
                setTimeout(() => this.executeWithRetriesImplementation(operationName, operation, currentRetryCount, url, headers, resolve, reject), 4 * 1000);
            }
        });
    }
}