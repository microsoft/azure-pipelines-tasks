/*
 * ---------------------------------------------------------
 * Copyright(C) Microsoft Corporation. All rights reserved.
 * ---------------------------------------------------------
 * 
 * ---------------------------------------------------------
 * Generated file, DO NOT EDIT
 * ---------------------------------------------------------
 */

// Licensed under the MIT license.  See LICENSE file in the project root for full license information.

import * as restm from 'artifact-engine/Providers/typed-rest-client/RestClient';
import * as httpm from 'artifact-engine/Providers/typed-rest-client/HttpClient';
import vsom = require('./VsoClient');
import basem = require('./ClientApiBases');
import serm = require('./Serialization');
import VsoBaseInterfaces = require('./interfaces/common/VsoBaseInterfaces');
import BuildInterfaces = require("./interfaces/BuildInterfaces");
import VSSInterfaces = require("./interfaces/common/VSSInterfaces");

export interface IBuildApi extends basem.ClientApiBase {
    createArtifact(artifact: BuildInterfaces.BuildArtifact, buildId: number, project?: string): Promise<BuildInterfaces.BuildArtifact>;
    getArtifact(buildId: number, artifactName: string, project?: string): Promise<BuildInterfaces.BuildArtifact>;
    getArtifactContentZip(buildId: number, artifactName: string, project?: string): Promise<NodeJS.ReadableStream>;
    getArtifacts(buildId: number, project?: string): Promise<BuildInterfaces.BuildArtifact[]>;
    getBadge(project: string, definitionId: number, branchName?: string): Promise<string>;
    getBuildBadge(project: string, repoType: string, repoId?: string, branchName?: string): Promise<BuildInterfaces.BuildBadge>;
    getBuildBadgeData(project: string, repoType: string, repoId?: string, branchName?: string): Promise<string>;
    deleteBuild(buildId: number, project?: string): Promise<void>;
    getBuild(buildId: number, project?: string, propertyFilters?: string): Promise<BuildInterfaces.Build>;
    getBuilds(project?: string, definitions?: number[], queues?: number[], buildNumber?: string, minFinishTime?: Date, maxFinishTime?: Date, requestedFor?: string, reasonFilter?: BuildInterfaces.BuildReason, statusFilter?: BuildInterfaces.BuildStatus, resultFilter?: BuildInterfaces.BuildResult, tagFilters?: string[], properties?: string[], top?: number, continuationToken?: string, maxBuildsPerDefinition?: number, deletedFilter?: BuildInterfaces.QueryDeletedOption, queryOrder?: BuildInterfaces.BuildQueryOrder, branchName?: string, buildIds?: number[], repositoryId?: string, repositoryType?: string): Promise<BuildInterfaces.Build[]>;
    queueBuild(build: BuildInterfaces.Build, project?: string, ignoreWarnings?: boolean, checkInTicket?: string): Promise<BuildInterfaces.Build>;
    updateBuild(build: BuildInterfaces.Build, buildId: number, project?: string): Promise<BuildInterfaces.Build>;
    updateBuilds(builds: BuildInterfaces.Build[], project?: string): Promise<BuildInterfaces.Build[]>;
    getBuildChanges(project: string, buildId: number, continuationToken?: string, top?: number, includeSourceChange?: boolean): Promise<BuildInterfaces.Change[]>;
    getChangesBetweenBuilds(project: string, fromBuildId?: number, toBuildId?: number, top?: number): Promise<BuildInterfaces.Change[]>;
    getBuildController(controllerId: number): Promise<BuildInterfaces.BuildController>;
    getBuildControllers(name?: string): Promise<BuildInterfaces.BuildController[]>;
    createDefinition(definition: BuildInterfaces.BuildDefinition, project?: string, definitionToCloneId?: number, definitionToCloneRevision?: number): Promise<BuildInterfaces.BuildDefinition>;
    deleteDefinition(definitionId: number, project?: string): Promise<void>;
    getDefinition(definitionId: number, project?: string, revision?: number, minMetricsTime?: Date, propertyFilters?: string[], includeLatestBuilds?: boolean): Promise<BuildInterfaces.BuildDefinition>;
    getDefinitions(project?: string, name?: string, repositoryId?: string, repositoryType?: string, queryOrder?: BuildInterfaces.DefinitionQueryOrder, top?: number, continuationToken?: string, minMetricsTime?: Date, definitionIds?: number[], path?: string, builtAfter?: Date, notBuiltAfter?: Date, includeAllProperties?: boolean, includeLatestBuilds?: boolean): Promise<BuildInterfaces.BuildDefinitionReference[]>;
    updateDefinition(definition: BuildInterfaces.BuildDefinition, definitionId: number, project?: string, secretsSourceDefinitionId?: number, secretsSourceDefinitionRevision?: number): Promise<BuildInterfaces.BuildDefinition>;
    createFolder(folder: BuildInterfaces.Folder, project: string, path: string): Promise<BuildInterfaces.Folder>;
    deleteFolder(project: string, path: string): Promise<void>;
    getFolders(project: string, path?: string, queryOrder?: BuildInterfaces.FolderQueryOrder): Promise<BuildInterfaces.Folder[]>;
    updateFolder(folder: BuildInterfaces.Folder, project: string, path: string): Promise<BuildInterfaces.Folder>;
    getBuildLog(project: string, buildId: number, logId: number, startLine?: number, endLine?: number): Promise<NodeJS.ReadableStream>;
    getBuildLogLines(project: string, buildId: number, logId: number, startLine?: number, endLine?: number): Promise<string[]>;
    getBuildLogs(project: string, buildId: number): Promise<BuildInterfaces.BuildLog[]>;
    getBuildLogsZip(project: string, buildId: number): Promise<NodeJS.ReadableStream>;
    getProjectMetrics(project: string, metricAggregationType?: string, minMetricsTime?: Date): Promise<BuildInterfaces.BuildMetric[]>;
    getDefinitionMetrics(project: string, definitionId: number, minMetricsTime?: Date): Promise<BuildInterfaces.BuildMetric[]>;
    getBuildOptionDefinitions(project?: string): Promise<BuildInterfaces.BuildOptionDefinition[]>;
    getBuildProperties(project: string, buildId: number, filter?: string[]): Promise<any>;
    updateBuildProperties(customHeaders: any, document: VSSInterfaces.JsonPatchDocument, project: string, buildId: number): Promise<any>;
    getDefinitionProperties(project: string, definitionId: number, filter?: string[]): Promise<any>;
    updateDefinitionProperties(customHeaders: any, document: VSSInterfaces.JsonPatchDocument, project: string, definitionId: number): Promise<any>;
    getBuildReport(project: string, buildId: number, type?: string): Promise<BuildInterfaces.BuildReportMetadata>;
    getBuildReportHtmlContent(project: string, buildId: number, type?: string): Promise<NodeJS.ReadableStream>;
    getResourceUsage(): Promise<BuildInterfaces.BuildResourceUsage>;
    getDefinitionRevisions(project: string, definitionId: number): Promise<BuildInterfaces.BuildDefinitionRevision[]>;
    getBuildSettings(): Promise<BuildInterfaces.BuildSettings>;
    updateBuildSettings(settings: BuildInterfaces.BuildSettings): Promise<BuildInterfaces.BuildSettings>;
    addBuildTag(project: string, buildId: number, tag: string): Promise<string[]>;
    addBuildTags(tags: string[], project: string, buildId: number): Promise<string[]>;
    deleteBuildTag(project: string, buildId: number, tag: string): Promise<string[]>;
    getBuildTags(project: string, buildId: number): Promise<string[]>;
    addDefinitionTag(project: string, definitionId: number, tag: string): Promise<string[]>;
    addDefinitionTags(tags: string[], project: string, definitionId: number): Promise<string[]>;
    deleteDefinitionTag(project: string, definitionId: number, tag: string): Promise<string[]>;
    getDefinitionTags(project: string, definitionId: number, revision?: number): Promise<string[]>;
    getTags(project: string): Promise<string[]>;
    deleteTemplate(project: string, templateId: string): Promise<void>;
    getTemplate(project: string, templateId: string): Promise<BuildInterfaces.BuildDefinitionTemplate>;
    getTemplates(project: string): Promise<BuildInterfaces.BuildDefinitionTemplate[]>;
    saveTemplate(template: BuildInterfaces.BuildDefinitionTemplate, project: string, templateId: string): Promise<BuildInterfaces.BuildDefinitionTemplate>;
    getBuildTimeline(project: string, buildId: number, timelineId?: string, changeId?: number, planId?: string): Promise<BuildInterfaces.Timeline>;
    getBuildWorkItemsRefs(project: string, buildId: number, top?: number): Promise<VSSInterfaces.ResourceRef[]>;
    getBuildWorkItemsRefsFromCommits(commitIds: string[], project: string, buildId: number, top?: number): Promise<VSSInterfaces.ResourceRef[]>;
    getWorkItemsBetweenBuilds(project: string, fromBuildId: number, toBuildId: number, top?: number): Promise<VSSInterfaces.ResourceRef[]>;
}

export class BuildApi extends basem.ClientApiBase implements IBuildApi {
    constructor(baseUrl: string, handlers: VsoBaseInterfaces.IRequestHandler[], options?: VsoBaseInterfaces.IRequestOptions) {
        super(baseUrl, handlers, 'node-Build-api', options);
    }

    /**
     * Associates an artifact with a build
     * 
     * @param {BuildInterfaces.BuildArtifact} artifact
     * @param {number} buildId
     * @param {string} project - Project ID or project name
     */
    public async createArtifact(
        artifact: BuildInterfaces.BuildArtifact,
        buildId: number,
        project?: string
        ): Promise<BuildInterfaces.BuildArtifact> {

        return new Promise<BuildInterfaces.BuildArtifact>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                buildId: buildId
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.3",
                    "build",
                    "1db06c96-014e-44e1-ac91-90b2d4b3e984",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.BuildArtifact>;
                res = await this.rest.create<BuildInterfaces.BuildArtifact>(url, artifact, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              false);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets a specific artifact for a build
     * 
     * @param {number} buildId
     * @param {string} artifactName
     * @param {string} project - Project ID or project name
     */
    public async getArtifact(
        buildId: number,
        artifactName: string,
        project?: string
        ): Promise<BuildInterfaces.BuildArtifact> {

        return new Promise<BuildInterfaces.BuildArtifact>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                buildId: buildId
            };

            let queryValues: any = {
                artifactName: artifactName,
            };
            
            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.3",
                    "build",
                    "1db06c96-014e-44e1-ac91-90b2d4b3e984",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.BuildArtifact>;
                res = await this.rest.get<BuildInterfaces.BuildArtifact>(url, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              false);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets a specific artifact for a build
     * 
     * @param {number} buildId
     * @param {string} artifactName
     * @param {string} project - Project ID or project name
     */
    public async getArtifactContentZip(
        buildId: number,
        artifactName: string,
        project?: string
        ): Promise<NodeJS.ReadableStream> {

        return new Promise<NodeJS.ReadableStream>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                buildId: buildId
            };

            let queryValues: any = {
                artifactName: artifactName,
            };
            
            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.3",
                    "build",
                    "1db06c96-014e-44e1-ac91-90b2d4b3e984",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                
                let apiVersion: string = verData.apiVersion;
                let accept: string = this.createAcceptHeader("application/zip", apiVersion);
                resolve((await this.http.get(url, { "Accept": accept })).message);
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets all artifacts for a build
     * 
     * @param {number} buildId
     * @param {string} project - Project ID or project name
     */
    public async getArtifacts(
        buildId: number,
        project?: string
        ): Promise<BuildInterfaces.BuildArtifact[]> {

        return new Promise<BuildInterfaces.BuildArtifact[]>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                buildId: buildId
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.3",
                    "build",
                    "1db06c96-014e-44e1-ac91-90b2d4b3e984",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.BuildArtifact[]>;
                res = await this.rest.get<BuildInterfaces.BuildArtifact[]>(url, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              true);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * @param {string} project
     * @param {number} definitionId
     * @param {string} branchName
     */
    public async getBadge(
        project: string,
        definitionId: number,
        branchName?: string
        ): Promise<string> {

        return new Promise<string>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                definitionId: definitionId
            };

            let queryValues: any = {
                branchName: branchName,
            };
            
            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "de6a4df8-22cd-44ee-af2d-39f6aa7a4261",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<string>;
                res = await this.rest.get<string>(url, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              false);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * @param {string} project - Project ID or project name
     * @param {string} repoType
     * @param {string} repoId
     * @param {string} branchName
     */
    public async getBuildBadge(
        project: string,
        repoType: string,
        repoId?: string,
        branchName?: string
        ): Promise<BuildInterfaces.BuildBadge> {

        return new Promise<BuildInterfaces.BuildBadge>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                repoType: repoType
            };

            let queryValues: any = {
                repoId: repoId,
                branchName: branchName,
            };
            
            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.1",
                    "build",
                    "21b3b9ce-fad5-4567-9ad0-80679794e003",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.BuildBadge>;
                res = await this.rest.get<BuildInterfaces.BuildBadge>(url, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              false);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * @param {string} project - Project ID or project name
     * @param {string} repoType
     * @param {string} repoId
     * @param {string} branchName
     */
    public async getBuildBadgeData(
        project: string,
        repoType: string,
        repoId?: string,
        branchName?: string
        ): Promise<string> {

        return new Promise<string>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                repoType: repoType
            };

            let queryValues: any = {
                repoId: repoId,
                branchName: branchName,
            };
            
            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.1",
                    "build",
                    "21b3b9ce-fad5-4567-9ad0-80679794e003",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<string>;
                res = await this.rest.get<string>(url, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              false);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Deletes a build
     * 
     * @param {number} buildId
     * @param {string} project - Project ID or project name
     */
    public async deleteBuild(
        buildId: number,
        project?: string
        ): Promise<void> {

        return new Promise<void>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                buildId: buildId
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.3",
                    "build",
                    "0cd358e1-9217-4d94-8269-1c1ee6f93dcf",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<void>;
                res = await this.rest.del<void>(url, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              false);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets a build
     * 
     * @param {number} buildId
     * @param {string} project - Project ID or project name
     * @param {string} propertyFilters - A comma-delimited list of properties to include in the results
     */
    public async getBuild(
        buildId: number,
        project?: string,
        propertyFilters?: string
        ): Promise<BuildInterfaces.Build> {

        return new Promise<BuildInterfaces.Build>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                buildId: buildId
            };

            let queryValues: any = {
                propertyFilters: propertyFilters,
            };
            
            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.3",
                    "build",
                    "0cd358e1-9217-4d94-8269-1c1ee6f93dcf",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.Build>;
                res = await this.rest.get<BuildInterfaces.Build>(url, options);

                let ret = this.formatResponse(res.result,
                                              BuildInterfaces.TypeInfo.Build,
                                              false);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets builds
     * 
     * @param {string} project - Project ID or project name
     * @param {number[]} definitions - A comma-delimited list of definition ids
     * @param {number[]} queues - A comma-delimited list of queue ids
     * @param {string} buildNumber
     * @param {Date} minFinishTime
     * @param {Date} maxFinishTime
     * @param {string} requestedFor
     * @param {BuildInterfaces.BuildReason} reasonFilter
     * @param {BuildInterfaces.BuildStatus} statusFilter
     * @param {BuildInterfaces.BuildResult} resultFilter
     * @param {string[]} tagFilters - A comma-delimited list of tags
     * @param {string[]} properties - A comma-delimited list of properties to include in the results
     * @param {number} top - The maximum number of builds to retrieve
     * @param {string} continuationToken
     * @param {number} maxBuildsPerDefinition
     * @param {BuildInterfaces.QueryDeletedOption} deletedFilter
     * @param {BuildInterfaces.BuildQueryOrder} queryOrder
     * @param {string} branchName
     * @param {number[]} buildIds
     * @param {string} repositoryId
     * @param {string} repositoryType
     */
    public async getBuilds(
        project?: string,
        definitions?: number[],
        queues?: number[],
        buildNumber?: string,
        minFinishTime?: Date,
        maxFinishTime?: Date,
        requestedFor?: string,
        reasonFilter?: BuildInterfaces.BuildReason,
        statusFilter?: BuildInterfaces.BuildStatus,
        resultFilter?: BuildInterfaces.BuildResult,
        tagFilters?: string[],
        properties?: string[],
        top?: number,
        continuationToken?: string,
        maxBuildsPerDefinition?: number,
        deletedFilter?: BuildInterfaces.QueryDeletedOption,
        queryOrder?: BuildInterfaces.BuildQueryOrder,
        branchName?: string,
        buildIds?: number[],
        repositoryId?: string,
        repositoryType?: string
        ): Promise<BuildInterfaces.Build[]> {

        return new Promise<BuildInterfaces.Build[]>(async (resolve, reject) => {
            let routeValues: any = {
                project: project
            };

            let queryValues: any = {
                definitions: definitions && definitions.join(","),
                queues: queues && queues.join(","),
                buildNumber: buildNumber,
                minFinishTime: minFinishTime,
                maxFinishTime: maxFinishTime,
                requestedFor: requestedFor,
                reasonFilter: reasonFilter,
                statusFilter: statusFilter,
                resultFilter: resultFilter,
                tagFilters: tagFilters && tagFilters.join(","),
                properties: properties && properties.join(","),
                '$top': top,
                continuationToken: continuationToken,
                maxBuildsPerDefinition: maxBuildsPerDefinition,
                deletedFilter: deletedFilter,
                queryOrder: queryOrder,
                branchName: branchName,
                buildIds: buildIds && buildIds.join(","),
                repositoryId: repositoryId,
                repositoryType: repositoryType,
            };
            
            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.3",
                    "build",
                    "0cd358e1-9217-4d94-8269-1c1ee6f93dcf",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.Build[]>;
                res = await this.rest.get<BuildInterfaces.Build[]>(url, options);

                let ret = this.formatResponse(res.result,
                                              BuildInterfaces.TypeInfo.Build,
                                              true);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Queues a build
     * 
     * @param {BuildInterfaces.Build} build
     * @param {string} project - Project ID or project name
     * @param {boolean} ignoreWarnings
     * @param {string} checkInTicket
     */
    public async queueBuild(
        build: BuildInterfaces.Build,
        project?: string,
        ignoreWarnings?: boolean,
        checkInTicket?: string
        ): Promise<BuildInterfaces.Build> {

        return new Promise<BuildInterfaces.Build>(async (resolve, reject) => {
            let routeValues: any = {
                project: project
            };

            let queryValues: any = {
                ignoreWarnings: ignoreWarnings,
                checkInTicket: checkInTicket,
            };
            
            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.3",
                    "build",
                    "0cd358e1-9217-4d94-8269-1c1ee6f93dcf",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.Build>;
                res = await this.rest.create<BuildInterfaces.Build>(url, build, options);

                let ret = this.formatResponse(res.result,
                                              BuildInterfaces.TypeInfo.Build,
                                              false);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Updates a build
     * 
     * @param {BuildInterfaces.Build} build
     * @param {number} buildId
     * @param {string} project - Project ID or project name
     */
    public async updateBuild(
        build: BuildInterfaces.Build,
        buildId: number,
        project?: string
        ): Promise<BuildInterfaces.Build> {

        return new Promise<BuildInterfaces.Build>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                buildId: buildId
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.3",
                    "build",
                    "0cd358e1-9217-4d94-8269-1c1ee6f93dcf",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.Build>;
                res = await this.rest.update<BuildInterfaces.Build>(url, build, options);

                let ret = this.formatResponse(res.result,
                                              BuildInterfaces.TypeInfo.Build,
                                              false);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Update a batch of builds
     * 
     * @param {BuildInterfaces.Build[]} builds
     * @param {string} project - Project ID or project name
     */
    public async updateBuilds(
        builds: BuildInterfaces.Build[],
        project?: string
        ): Promise<BuildInterfaces.Build[]> {

        return new Promise<BuildInterfaces.Build[]>(async (resolve, reject) => {
            let routeValues: any = {
                project: project
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.3",
                    "build",
                    "0cd358e1-9217-4d94-8269-1c1ee6f93dcf",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.Build[]>;
                res = await this.rest.update<BuildInterfaces.Build[]>(url, builds, options);

                let ret = this.formatResponse(res.result,
                                              BuildInterfaces.TypeInfo.Build,
                                              true);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets the changes associated with a build
     * 
     * @param {string} project - Project ID or project name
     * @param {number} buildId
     * @param {string} continuationToken
     * @param {number} top - The maximum number of changes to return
     * @param {boolean} includeSourceChange
     */
    public async getBuildChanges(
        project: string,
        buildId: number,
        continuationToken?: string,
        top?: number,
        includeSourceChange?: boolean
        ): Promise<BuildInterfaces.Change[]> {

        return new Promise<BuildInterfaces.Change[]>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                buildId: buildId
            };

            let queryValues: any = {
                continuationToken: continuationToken,
                '$top': top,
                includeSourceChange: includeSourceChange,
            };
            
            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "54572c7b-bbd3-45d4-80dc-28be08941620",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.Change[]>;
                res = await this.rest.get<BuildInterfaces.Change[]>(url, options);

                let ret = this.formatResponse(res.result,
                                              BuildInterfaces.TypeInfo.Change,
                                              true);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets the changes associated between given builds
     * 
     * @param {string} project - Project ID or project name
     * @param {number} fromBuildId
     * @param {number} toBuildId
     * @param {number} top - The maximum number of changes to return
     */
    public async getChangesBetweenBuilds(
        project: string,
        fromBuildId?: number,
        toBuildId?: number,
        top?: number
        ): Promise<BuildInterfaces.Change[]> {

        return new Promise<BuildInterfaces.Change[]>(async (resolve, reject) => {
            let routeValues: any = {
                project: project
            };

            let queryValues: any = {
                fromBuildId: fromBuildId,
                toBuildId: toBuildId,
                '$top': top,
            };
            
            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "f10f0ea5-18a1-43ec-a8fb-2042c7be9b43",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.Change[]>;
                res = await this.rest.get<BuildInterfaces.Change[]>(url, options);

                let ret = this.formatResponse(res.result,
                                              BuildInterfaces.TypeInfo.Change,
                                              true);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets a controller
     * 
     * @param {number} controllerId
     */
    public async getBuildController(
        controllerId: number
        ): Promise<BuildInterfaces.BuildController> {

        return new Promise<BuildInterfaces.BuildController>(async (resolve, reject) => {
            let routeValues: any = {
                controllerId: controllerId
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "fcac1932-2ee1-437f-9b6f-7f696be858f6",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.BuildController>;
                res = await this.rest.get<BuildInterfaces.BuildController>(url, options);

                let ret = this.formatResponse(res.result,
                                              BuildInterfaces.TypeInfo.BuildController,
                                              false);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets controller, optionally filtered by name
     * 
     * @param {string} name
     */
    public async getBuildControllers(
        name?: string
        ): Promise<BuildInterfaces.BuildController[]> {

        return new Promise<BuildInterfaces.BuildController[]>(async (resolve, reject) => {
            let routeValues: any = {
            };

            let queryValues: any = {
                name: name,
            };
            
            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "fcac1932-2ee1-437f-9b6f-7f696be858f6",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.BuildController[]>;
                res = await this.rest.get<BuildInterfaces.BuildController[]>(url, options);

                let ret = this.formatResponse(res.result,
                                              BuildInterfaces.TypeInfo.BuildController,
                                              true);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Creates a new definition
     * 
     * @param {BuildInterfaces.BuildDefinition} definition
     * @param {string} project - Project ID or project name
     * @param {number} definitionToCloneId
     * @param {number} definitionToCloneRevision
     */
    public async createDefinition(
        definition: BuildInterfaces.BuildDefinition,
        project?: string,
        definitionToCloneId?: number,
        definitionToCloneRevision?: number
        ): Promise<BuildInterfaces.BuildDefinition> {

        return new Promise<BuildInterfaces.BuildDefinition>(async (resolve, reject) => {
            let routeValues: any = {
                project: project
            };

            let queryValues: any = {
                definitionToCloneId: definitionToCloneId,
                definitionToCloneRevision: definitionToCloneRevision,
            };
            
            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.4",
                    "build",
                    "dbeaf647-6167-421a-bda9-c9327b25e2e6",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.BuildDefinition>;
                res = await this.rest.create<BuildInterfaces.BuildDefinition>(url, definition, options);

                let ret = this.formatResponse(res.result,
                                              BuildInterfaces.TypeInfo.BuildDefinition,
                                              false);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Deletes a definition and all associated builds
     * 
     * @param {number} definitionId
     * @param {string} project - Project ID or project name
     */
    public async deleteDefinition(
        definitionId: number,
        project?: string
        ): Promise<void> {

        return new Promise<void>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                definitionId: definitionId
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.4",
                    "build",
                    "dbeaf647-6167-421a-bda9-c9327b25e2e6",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<void>;
                res = await this.rest.del<void>(url, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              false);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets a definition, optionally at a specific revision
     * 
     * @param {number} definitionId
     * @param {string} project - Project ID or project name
     * @param {number} revision
     * @param {Date} minMetricsTime
     * @param {string[]} propertyFilters
     * @param {boolean} includeLatestBuilds
     */
    public async getDefinition(
        definitionId: number,
        project?: string,
        revision?: number,
        minMetricsTime?: Date,
        propertyFilters?: string[],
        includeLatestBuilds?: boolean
        ): Promise<BuildInterfaces.BuildDefinition> {

        return new Promise<BuildInterfaces.BuildDefinition>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                definitionId: definitionId
            };

            let queryValues: any = {
                revision: revision,
                minMetricsTime: minMetricsTime,
                propertyFilters: propertyFilters && propertyFilters.join(","),
                includeLatestBuilds: includeLatestBuilds,
            };
            
            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.4",
                    "build",
                    "dbeaf647-6167-421a-bda9-c9327b25e2e6",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.BuildDefinition>;
                res = await this.rest.get<BuildInterfaces.BuildDefinition>(url, options);

                let ret = this.formatResponse(res.result,
                                              BuildInterfaces.TypeInfo.BuildDefinition,
                                              false);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets definitions, optionally filtered by name
     * 
     * @param {string} project - Project ID or project name
     * @param {string} name
     * @param {string} repositoryId
     * @param {string} repositoryType
     * @param {BuildInterfaces.DefinitionQueryOrder} queryOrder
     * @param {number} top
     * @param {string} continuationToken
     * @param {Date} minMetricsTime
     * @param {number[]} definitionIds
     * @param {string} path
     * @param {Date} builtAfter
     * @param {Date} notBuiltAfter
     * @param {boolean} includeAllProperties
     * @param {boolean} includeLatestBuilds
     */
    public async getDefinitions(
        project?: string,
        name?: string,
        repositoryId?: string,
        repositoryType?: string,
        queryOrder?: BuildInterfaces.DefinitionQueryOrder,
        top?: number,
        continuationToken?: string,
        minMetricsTime?: Date,
        definitionIds?: number[],
        path?: string,
        builtAfter?: Date,
        notBuiltAfter?: Date,
        includeAllProperties?: boolean,
        includeLatestBuilds?: boolean
        ): Promise<BuildInterfaces.BuildDefinitionReference[]> {

        return new Promise<BuildInterfaces.BuildDefinitionReference[]>(async (resolve, reject) => {
            let routeValues: any = {
                project: project
            };

            let queryValues: any = {
                name: name,
                repositoryId: repositoryId,
                repositoryType: repositoryType,
                queryOrder: queryOrder,
                '$top': top,
                continuationToken: continuationToken,
                minMetricsTime: minMetricsTime,
                definitionIds: definitionIds && definitionIds.join(","),
                path: path,
                builtAfter: builtAfter,
                notBuiltAfter: notBuiltAfter,
                includeAllProperties: includeAllProperties,
                includeLatestBuilds: includeLatestBuilds,
            };
            
            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.4",
                    "build",
                    "dbeaf647-6167-421a-bda9-c9327b25e2e6",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.BuildDefinitionReference[]>;
                res = await this.rest.get<BuildInterfaces.BuildDefinitionReference[]>(url, options);

                let ret = this.formatResponse(res.result,
                                              BuildInterfaces.TypeInfo.BuildDefinitionReference,
                                              true);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Updates an existing definition
     * 
     * @param {BuildInterfaces.BuildDefinition} definition
     * @param {number} definitionId
     * @param {string} project - Project ID or project name
     * @param {number} secretsSourceDefinitionId
     * @param {number} secretsSourceDefinitionRevision
     */
    public async updateDefinition(
        definition: BuildInterfaces.BuildDefinition,
        definitionId: number,
        project?: string,
        secretsSourceDefinitionId?: number,
        secretsSourceDefinitionRevision?: number
        ): Promise<BuildInterfaces.BuildDefinition> {

        return new Promise<BuildInterfaces.BuildDefinition>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                definitionId: definitionId
            };

            let queryValues: any = {
                secretsSourceDefinitionId: secretsSourceDefinitionId,
                secretsSourceDefinitionRevision: secretsSourceDefinitionRevision,
            };
            
            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.4",
                    "build",
                    "dbeaf647-6167-421a-bda9-c9327b25e2e6",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.BuildDefinition>;
                res = await this.rest.replace<BuildInterfaces.BuildDefinition>(url, definition, options);

                let ret = this.formatResponse(res.result,
                                              BuildInterfaces.TypeInfo.BuildDefinition,
                                              false);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Creates a new folder
     * 
     * @param {BuildInterfaces.Folder} folder
     * @param {string} project - Project ID or project name
     * @param {string} path
     */
    public async createFolder(
        folder: BuildInterfaces.Folder,
        project: string,
        path: string
        ): Promise<BuildInterfaces.Folder> {

        return new Promise<BuildInterfaces.Folder>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                path: path
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.1",
                    "build",
                    "a906531b-d2da-4f55-bda7-f3e676cc50d9",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.Folder>;
                res = await this.rest.replace<BuildInterfaces.Folder>(url, folder, options);

                let ret = this.formatResponse(res.result,
                                              BuildInterfaces.TypeInfo.Folder,
                                              false);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Deletes a definition folder for given folder name and path and all it's existing definitions and it's corresponding builds
     * 
     * @param {string} project - Project ID or project name
     * @param {string} path
     */
    public async deleteFolder(
        project: string,
        path: string
        ): Promise<void> {

        return new Promise<void>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                path: path
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.1",
                    "build",
                    "a906531b-d2da-4f55-bda7-f3e676cc50d9",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<void>;
                res = await this.rest.del<void>(url, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              false);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets folders
     * 
     * @param {string} project - Project ID or project name
     * @param {string} path
     * @param {BuildInterfaces.FolderQueryOrder} queryOrder
     */
    public async getFolders(
        project: string,
        path?: string,
        queryOrder?: BuildInterfaces.FolderQueryOrder
        ): Promise<BuildInterfaces.Folder[]> {

        return new Promise<BuildInterfaces.Folder[]>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                path: path
            };

            let queryValues: any = {
                queryOrder: queryOrder,
            };
            
            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.1",
                    "build",
                    "a906531b-d2da-4f55-bda7-f3e676cc50d9",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.Folder[]>;
                res = await this.rest.get<BuildInterfaces.Folder[]>(url, options);

                let ret = this.formatResponse(res.result,
                                              BuildInterfaces.TypeInfo.Folder,
                                              true);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Updates an existing folder at given  existing path
     * 
     * @param {BuildInterfaces.Folder} folder
     * @param {string} project - Project ID or project name
     * @param {string} path
     */
    public async updateFolder(
        folder: BuildInterfaces.Folder,
        project: string,
        path: string
        ): Promise<BuildInterfaces.Folder> {

        return new Promise<BuildInterfaces.Folder>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                path: path
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.1",
                    "build",
                    "a906531b-d2da-4f55-bda7-f3e676cc50d9",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.Folder>;
                res = await this.rest.create<BuildInterfaces.Folder>(url, folder, options);

                let ret = this.formatResponse(res.result,
                                              BuildInterfaces.TypeInfo.Folder,
                                              false);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets a log
     * 
     * @param {string} project - Project ID or project name
     * @param {number} buildId
     * @param {number} logId
     * @param {number} startLine
     * @param {number} endLine
     */
    public async getBuildLog(
        project: string,
        buildId: number,
        logId: number,
        startLine?: number,
        endLine?: number
        ): Promise<NodeJS.ReadableStream> {

        return new Promise<NodeJS.ReadableStream>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                buildId: buildId,
                logId: logId
            };

            let queryValues: any = {
                startLine: startLine,
                endLine: endLine,
            };
            
            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "35a80daf-7f30-45fc-86e8-6b813d9c90df",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                
                let apiVersion: string = verData.apiVersion;
                let accept: string = this.createAcceptHeader("text/plain", apiVersion);
                resolve((await this.http.get(url, { "Accept": accept })).message);
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets a log
     * 
     * @param {string} project - Project ID or project name
     * @param {number} buildId
     * @param {number} logId
     * @param {number} startLine
     * @param {number} endLine
     */
    public async getBuildLogLines(
        project: string,
        buildId: number,
        logId: number,
        startLine?: number,
        endLine?: number
        ): Promise<string[]> {

        return new Promise<string[]>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                buildId: buildId,
                logId: logId
            };

            let queryValues: any = {
                startLine: startLine,
                endLine: endLine,
            };
            
            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "35a80daf-7f30-45fc-86e8-6b813d9c90df",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<string[]>;
                res = await this.rest.get<string[]>(url, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              true);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets logs for a build
     * 
     * @param {string} project - Project ID or project name
     * @param {number} buildId
     */
    public async getBuildLogs(
        project: string,
        buildId: number
        ): Promise<BuildInterfaces.BuildLog[]> {

        return new Promise<BuildInterfaces.BuildLog[]>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                buildId: buildId
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "35a80daf-7f30-45fc-86e8-6b813d9c90df",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.BuildLog[]>;
                res = await this.rest.get<BuildInterfaces.BuildLog[]>(url, options);

                let ret = this.formatResponse(res.result,
                                              BuildInterfaces.TypeInfo.BuildLog,
                                              true);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets logs for a build
     * 
     * @param {string} project - Project ID or project name
     * @param {number} buildId
     */
    public async getBuildLogsZip(
        project: string,
        buildId: number
        ): Promise<NodeJS.ReadableStream> {

        return new Promise<NodeJS.ReadableStream>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                buildId: buildId
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "35a80daf-7f30-45fc-86e8-6b813d9c90df",
                    routeValues);

                let url: string = verData.requestUrl;
                
                let apiVersion: string = verData.apiVersion;
                let accept: string = this.createAcceptHeader("application/zip", apiVersion);
                resolve((await this.http.get(url, { "Accept": accept })).message);
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets metrics of a project
     * 
     * @param {string} project - Project ID or project name
     * @param {string} metricAggregationType
     * @param {Date} minMetricsTime
     */
    public async getProjectMetrics(
        project: string,
        metricAggregationType?: string,
        minMetricsTime?: Date
        ): Promise<BuildInterfaces.BuildMetric[]> {

        return new Promise<BuildInterfaces.BuildMetric[]>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                metricAggregationType: metricAggregationType
            };

            let queryValues: any = {
                minMetricsTime: minMetricsTime,
            };
            
            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.1",
                    "build",
                    "7433fae7-a6bc-41dc-a6e2-eef9005ce41a",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.BuildMetric[]>;
                res = await this.rest.get<BuildInterfaces.BuildMetric[]>(url, options);

                let ret = this.formatResponse(res.result,
                                              BuildInterfaces.TypeInfo.BuildMetric,
                                              true);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets metrics of a definition
     * 
     * @param {string} project - Project ID or project name
     * @param {number} definitionId
     * @param {Date} minMetricsTime
     */
    public async getDefinitionMetrics(
        project: string,
        definitionId: number,
        minMetricsTime?: Date
        ): Promise<BuildInterfaces.BuildMetric[]> {

        return new Promise<BuildInterfaces.BuildMetric[]>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                definitionId: definitionId
            };

            let queryValues: any = {
                minMetricsTime: minMetricsTime,
            };
            
            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.1",
                    "build",
                    "d973b939-0ce0-4fec-91d8-da3940fa1827",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.BuildMetric[]>;
                res = await this.rest.get<BuildInterfaces.BuildMetric[]>(url, options);

                let ret = this.formatResponse(res.result,
                                              BuildInterfaces.TypeInfo.BuildMetric,
                                              true);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * @param {string} project - Project ID or project name
     */
    public async getBuildOptionDefinitions(
        project?: string
        ): Promise<BuildInterfaces.BuildOptionDefinition[]> {

        return new Promise<BuildInterfaces.BuildOptionDefinition[]>(async (resolve, reject) => {
            let routeValues: any = {
                project: project
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "591cb5a4-2d46-4f3a-a697-5cd42b6bd332",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.BuildOptionDefinition[]>;
                res = await this.rest.get<BuildInterfaces.BuildOptionDefinition[]>(url, options);

                let ret = this.formatResponse(res.result,
                                              BuildInterfaces.TypeInfo.BuildOptionDefinition,
                                              true);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets properties for a build.
     * 
     * @param {string} project - Project ID or project name
     * @param {number} buildId - The build id.
     * @param {string[]} filter - Filter to specific properties. Defaults to all properties.
     */
    public async getBuildProperties(
        project: string,
        buildId: number,
        filter?: string[]
        ): Promise<any> {

        return new Promise<any>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                buildId: buildId
            };

            let queryValues: any = {
                filter: filter && filter.join(","),
            };
            
            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.1",
                    "build",
                    "0a6312e9-0627-49b7-8083-7d74a64849c9",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<any>;
                res = await this.rest.get<any>(url, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              false);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Updates properties for a build.
     * 
     * @param {VSSInterfaces.JsonPatchDocument} document
     * @param {string} project - Project ID or project name
     * @param {number} buildId - The build id.
     */
    public async updateBuildProperties(
        customHeaders: any,
        document: VSSInterfaces.JsonPatchDocument,
        project: string,
        buildId: number
        ): Promise<any> {

        return new Promise<any>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                buildId: buildId
            };

            customHeaders = customHeaders || {};
            customHeaders["Content-Type"] = "application/json-patch+json";

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.1",
                    "build",
                    "0a6312e9-0627-49b7-8083-7d74a64849c9",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);
                options.additionalHeaders = customHeaders;

                let res: restm.IRestResponse<any>;
                res = await this.rest.update<any>(url, document, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              false);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets properties for a definition.
     * 
     * @param {string} project - Project ID or project name
     * @param {number} definitionId - The definition id.
     * @param {string[]} filter - Filter to specific properties. Defaults to all properties.
     */
    public async getDefinitionProperties(
        project: string,
        definitionId: number,
        filter?: string[]
        ): Promise<any> {

        return new Promise<any>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                definitionId: definitionId
            };

            let queryValues: any = {
                filter: filter && filter.join(","),
            };
            
            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.1",
                    "build",
                    "d9826ad7-2a68-46a9-a6e9-677698777895",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<any>;
                res = await this.rest.get<any>(url, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              false);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Updates properties for a definition.
     * 
     * @param {VSSInterfaces.JsonPatchDocument} document
     * @param {string} project - Project ID or project name
     * @param {number} definitionId - The definition id.
     */
    public async updateDefinitionProperties(
        customHeaders: any,
        document: VSSInterfaces.JsonPatchDocument,
        project: string,
        definitionId: number
        ): Promise<any> {

        return new Promise<any>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                definitionId: definitionId
            };

            customHeaders = customHeaders || {};
            customHeaders["Content-Type"] = "application/json-patch+json";

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.1",
                    "build",
                    "d9826ad7-2a68-46a9-a6e9-677698777895",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);
                options.additionalHeaders = customHeaders;

                let res: restm.IRestResponse<any>;
                res = await this.rest.update<any>(url, document, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              false);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets report for a build
     * 
     * @param {string} project - Project ID or project name
     * @param {number} buildId
     * @param {string} type
     */
    public async getBuildReport(
        project: string,
        buildId: number,
        type?: string
        ): Promise<BuildInterfaces.BuildReportMetadata> {

        return new Promise<BuildInterfaces.BuildReportMetadata>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                buildId: buildId
            };

            let queryValues: any = {
                type: type,
            };
            
            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "45bcaa88-67e1-4042-a035-56d3b4a7d44c",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.BuildReportMetadata>;
                res = await this.rest.get<BuildInterfaces.BuildReportMetadata>(url, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              false);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets report for a build
     * 
     * @param {string} project - Project ID or project name
     * @param {number} buildId
     * @param {string} type
     */
    public async getBuildReportHtmlContent(
        project: string,
        buildId: number,
        type?: string
        ): Promise<NodeJS.ReadableStream> {

        return new Promise<NodeJS.ReadableStream>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                buildId: buildId
            };

            let queryValues: any = {
                type: type,
            };
            
            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "45bcaa88-67e1-4042-a035-56d3b4a7d44c",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                
                let apiVersion: string = verData.apiVersion;
                let accept: string = this.createAcceptHeader("text/html", apiVersion);
                resolve((await this.http.get(url, { "Accept": accept })).message);
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     */
    public async getResourceUsage(
        ): Promise<BuildInterfaces.BuildResourceUsage> {

        return new Promise<BuildInterfaces.BuildResourceUsage>(async (resolve, reject) => {
            let routeValues: any = {
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "3813d06c-9e36-4ea1-aac3-61a485d60e3d",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.BuildResourceUsage>;
                res = await this.rest.get<BuildInterfaces.BuildResourceUsage>(url, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              false);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets revisions of a definition
     * 
     * @param {string} project - Project ID or project name
     * @param {number} definitionId
     */
    public async getDefinitionRevisions(
        project: string,
        definitionId: number
        ): Promise<BuildInterfaces.BuildDefinitionRevision[]> {

        return new Promise<BuildInterfaces.BuildDefinitionRevision[]>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                definitionId: definitionId
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "7c116775-52e5-453e-8c5d-914d9762d8c4",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.BuildDefinitionRevision[]>;
                res = await this.rest.get<BuildInterfaces.BuildDefinitionRevision[]>(url, options);

                let ret = this.formatResponse(res.result,
                                              BuildInterfaces.TypeInfo.BuildDefinitionRevision,
                                              true);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     */
    public async getBuildSettings(
        ): Promise<BuildInterfaces.BuildSettings> {

        return new Promise<BuildInterfaces.BuildSettings>(async (resolve, reject) => {
            let routeValues: any = {
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.1",
                    "build",
                    "aa8c1c9c-ef8b-474a-b8c4-785c7b191d0d",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.BuildSettings>;
                res = await this.rest.get<BuildInterfaces.BuildSettings>(url, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              false);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Updates the build settings
     * 
     * @param {BuildInterfaces.BuildSettings} settings
     */
    public async updateBuildSettings(
        settings: BuildInterfaces.BuildSettings
        ): Promise<BuildInterfaces.BuildSettings> {

        return new Promise<BuildInterfaces.BuildSettings>(async (resolve, reject) => {
            let routeValues: any = {
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.1",
                    "build",
                    "aa8c1c9c-ef8b-474a-b8c4-785c7b191d0d",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.BuildSettings>;
                res = await this.rest.update<BuildInterfaces.BuildSettings>(url, settings, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              false);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Adds a tag to a build
     * 
     * @param {string} project - Project ID or project name
     * @param {number} buildId
     * @param {string} tag
     */
    public async addBuildTag(
        project: string,
        buildId: number,
        tag: string
        ): Promise<string[]> {

        return new Promise<string[]>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                buildId: buildId,
                tag: tag
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "6e6114b2-8161-44c8-8f6c-c5505782427f",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<string[]>;
                res = await this.rest.replace<string[]>(url, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              true);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Adds tag to a build
     * 
     * @param {string[]} tags
     * @param {string} project - Project ID or project name
     * @param {number} buildId
     */
    public async addBuildTags(
        tags: string[],
        project: string,
        buildId: number
        ): Promise<string[]> {

        return new Promise<string[]>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                buildId: buildId
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "6e6114b2-8161-44c8-8f6c-c5505782427f",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<string[]>;
                res = await this.rest.create<string[]>(url, tags, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              true);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Deletes a tag from a build
     * 
     * @param {string} project - Project ID or project name
     * @param {number} buildId
     * @param {string} tag
     */
    public async deleteBuildTag(
        project: string,
        buildId: number,
        tag: string
        ): Promise<string[]> {

        return new Promise<string[]>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                buildId: buildId,
                tag: tag
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "6e6114b2-8161-44c8-8f6c-c5505782427f",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<string[]>;
                res = await this.rest.del<string[]>(url, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              true);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets the tags for a build
     * 
     * @param {string} project - Project ID or project name
     * @param {number} buildId
     */
    public async getBuildTags(
        project: string,
        buildId: number
        ): Promise<string[]> {

        return new Promise<string[]>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                buildId: buildId
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "6e6114b2-8161-44c8-8f6c-c5505782427f",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<string[]>;
                res = await this.rest.get<string[]>(url, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              true);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Adds a tag to a definition
     * 
     * @param {string} project - Project ID or project name
     * @param {number} definitionId
     * @param {string} tag
     */
    public async addDefinitionTag(
        project: string,
        definitionId: number,
        tag: string
        ): Promise<string[]> {

        return new Promise<string[]>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                definitionId: definitionId,
                tag: tag
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "cb894432-134a-4d31-a839-83beceaace4b",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<string[]>;
                res = await this.rest.replace<string[]>(url, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              true);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Adds multiple tags to a definition
     * 
     * @param {string[]} tags
     * @param {string} project - Project ID or project name
     * @param {number} definitionId
     */
    public async addDefinitionTags(
        tags: string[],
        project: string,
        definitionId: number
        ): Promise<string[]> {

        return new Promise<string[]>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                definitionId: definitionId
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "cb894432-134a-4d31-a839-83beceaace4b",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<string[]>;
                res = await this.rest.create<string[]>(url, tags, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              true);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Deletes a tag from a definition
     * 
     * @param {string} project - Project ID or project name
     * @param {number} definitionId
     * @param {string} tag
     */
    public async deleteDefinitionTag(
        project: string,
        definitionId: number,
        tag: string
        ): Promise<string[]> {

        return new Promise<string[]>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                definitionId: definitionId,
                tag: tag
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "cb894432-134a-4d31-a839-83beceaace4b",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<string[]>;
                res = await this.rest.del<string[]>(url, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              true);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets the tags for a definition
     * 
     * @param {string} project - Project ID or project name
     * @param {number} definitionId
     * @param {number} revision
     */
    public async getDefinitionTags(
        project: string,
        definitionId: number,
        revision?: number
        ): Promise<string[]> {

        return new Promise<string[]>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                definitionId: definitionId
            };

            let queryValues: any = {
                revision: revision,
            };
            
            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "cb894432-134a-4d31-a839-83beceaace4b",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<string[]>;
                res = await this.rest.get<string[]>(url, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              true);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * @param {string} project - Project ID or project name
     */
    public async getTags(
        project: string
        ): Promise<string[]> {

        return new Promise<string[]>(async (resolve, reject) => {
            let routeValues: any = {
                project: project
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "d84ac5c6-edc7-43d5-adc9-1b34be5dea09",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<string[]>;
                res = await this.rest.get<string[]>(url, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              true);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Deletes a definition template
     * 
     * @param {string} project - Project ID or project name
     * @param {string} templateId
     */
    public async deleteTemplate(
        project: string,
        templateId: string
        ): Promise<void> {

        return new Promise<void>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                templateId: templateId
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "e884571e-7f92-4d6a-9274-3f5649900835",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<void>;
                res = await this.rest.del<void>(url, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              false);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets definition template filtered by id
     * 
     * @param {string} project - Project ID or project name
     * @param {string} templateId - Id of the requested template.
     */
    public async getTemplate(
        project: string,
        templateId: string
        ): Promise<BuildInterfaces.BuildDefinitionTemplate> {

        return new Promise<BuildInterfaces.BuildDefinitionTemplate>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                templateId: templateId
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "e884571e-7f92-4d6a-9274-3f5649900835",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.BuildDefinitionTemplate>;
                res = await this.rest.get<BuildInterfaces.BuildDefinitionTemplate>(url, options);

                let ret = this.formatResponse(res.result,
                                              BuildInterfaces.TypeInfo.BuildDefinitionTemplate,
                                              false);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * @param {string} project - Project ID or project name
     */
    public async getTemplates(
        project: string
        ): Promise<BuildInterfaces.BuildDefinitionTemplate[]> {

        return new Promise<BuildInterfaces.BuildDefinitionTemplate[]>(async (resolve, reject) => {
            let routeValues: any = {
                project: project
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "e884571e-7f92-4d6a-9274-3f5649900835",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.BuildDefinitionTemplate[]>;
                res = await this.rest.get<BuildInterfaces.BuildDefinitionTemplate[]>(url, options);

                let ret = this.formatResponse(res.result,
                                              BuildInterfaces.TypeInfo.BuildDefinitionTemplate,
                                              true);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Saves a definition template
     * 
     * @param {BuildInterfaces.BuildDefinitionTemplate} template
     * @param {string} project - Project ID or project name
     * @param {string} templateId
     */
    public async saveTemplate(
        template: BuildInterfaces.BuildDefinitionTemplate,
        project: string,
        templateId: string
        ): Promise<BuildInterfaces.BuildDefinitionTemplate> {

        return new Promise<BuildInterfaces.BuildDefinitionTemplate>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                templateId: templateId
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "e884571e-7f92-4d6a-9274-3f5649900835",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.BuildDefinitionTemplate>;
                res = await this.rest.replace<BuildInterfaces.BuildDefinitionTemplate>(url, template, options);

                let ret = this.formatResponse(res.result,
                                              BuildInterfaces.TypeInfo.BuildDefinitionTemplate,
                                              false);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets details for a build
     * 
     * @param {string} project - Project ID or project name
     * @param {number} buildId
     * @param {string} timelineId
     * @param {number} changeId
     * @param {string} planId
     */
    public async getBuildTimeline(
        project: string,
        buildId: number,
        timelineId?: string,
        changeId?: number,
        planId?: string
        ): Promise<BuildInterfaces.Timeline> {

        return new Promise<BuildInterfaces.Timeline>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                buildId: buildId,
                timelineId: timelineId
            };

            let queryValues: any = {
                changeId: changeId,
                planId: planId,
            };
            
            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "8baac422-4c6e-4de5-8532-db96d92acffa",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<BuildInterfaces.Timeline>;
                res = await this.rest.get<BuildInterfaces.Timeline>(url, options);

                let ret = this.formatResponse(res.result,
                                              BuildInterfaces.TypeInfo.Timeline,
                                              false);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets the work item ids associated with a build
     * 
     * @param {string} project - Project ID or project name
     * @param {number} buildId
     * @param {number} top - The maximum number of workitems to return
     */
    public async getBuildWorkItemsRefs(
        project: string,
        buildId: number,
        top?: number
        ): Promise<VSSInterfaces.ResourceRef[]> {

        return new Promise<VSSInterfaces.ResourceRef[]>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                buildId: buildId
            };

            let queryValues: any = {
                '$top': top,
            };
            
            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "5a21f5d2-5642-47e4-a0bd-1356e6731bee",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<VSSInterfaces.ResourceRef[]>;
                res = await this.rest.get<VSSInterfaces.ResourceRef[]>(url, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              true);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets the work item ids associated with build commits
     * 
     * @param {string[]} commitIds
     * @param {string} project - Project ID or project name
     * @param {number} buildId
     * @param {number} top - The maximum number of workitems to return, also number of commits to consider if commitids are not sent
     */
    public async getBuildWorkItemsRefsFromCommits(
        commitIds: string[],
        project: string,
        buildId: number,
        top?: number
        ): Promise<VSSInterfaces.ResourceRef[]> {

        return new Promise<VSSInterfaces.ResourceRef[]>(async (resolve, reject) => {
            let routeValues: any = {
                project: project,
                buildId: buildId
            };

            let queryValues: any = {
                '$top': top,
            };
            
            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "5a21f5d2-5642-47e4-a0bd-1356e6731bee",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<VSSInterfaces.ResourceRef[]>;
                res = await this.rest.create<VSSInterfaces.ResourceRef[]>(url, commitIds, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              true);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gets all the work item ids inbetween fromBuildId to toBuildId
     * 
     * @param {string} project - Project ID or project name
     * @param {number} fromBuildId
     * @param {number} toBuildId
     * @param {number} top - The maximum number of workitems to return
     */
    public async getWorkItemsBetweenBuilds(
        project: string,
        fromBuildId: number,
        toBuildId: number,
        top?: number
        ): Promise<VSSInterfaces.ResourceRef[]> {

        return new Promise<VSSInterfaces.ResourceRef[]>(async (resolve, reject) => {
            let routeValues: any = {
                project: project
            };

            let queryValues: any = {
                fromBuildId: fromBuildId,
                toBuildId: toBuildId,
                '$top': top,
            };
            
            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "build",
                    "52ba8915-5518-42e3-a4bb-b0182d159e2d",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restm.IRestResponse<VSSInterfaces.ResourceRef[]>;
                res = await this.rest.get<VSSInterfaces.ResourceRef[]>(url, options);

                let ret = this.formatResponse(res.result,
                                              null,
                                              true);

                resolve(ret);
                
            }
            catch (err) {
                reject(err);
            }
        });
    }

}
