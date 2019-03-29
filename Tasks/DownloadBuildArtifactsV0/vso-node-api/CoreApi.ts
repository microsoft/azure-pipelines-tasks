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
import CoreInterfaces = require("./interfaces/CoreInterfaces");
import OperationsInterfaces = require("./interfaces/common/OperationsInterfaces");
import VSSInterfaces = require("./interfaces/common/VSSInterfaces");

export interface ICoreApi extends basem.ClientApiBase {
    createConnectedService(connectedServiceCreationData: CoreInterfaces.WebApiConnectedServiceDetails, projectId: string): Promise<CoreInterfaces.WebApiConnectedService>;
    getConnectedServiceDetails(projectId: string, name: string): Promise<CoreInterfaces.WebApiConnectedServiceDetails>;
    getConnectedServices(projectId: string, kind?: CoreInterfaces.ConnectedServiceKind): Promise<CoreInterfaces.WebApiConnectedService[]>;
    createIdentityMru(mruData: CoreInterfaces.IdentityData, mruName: string): Promise<void>;
    deleteIdentityMru(mruData: CoreInterfaces.IdentityData, mruName: string): Promise<void>;
    getIdentityMru(mruName: string): Promise<VSSInterfaces.IdentityRef[]>;
    updateIdentityMru(mruData: CoreInterfaces.IdentityData, mruName: string): Promise<void>;
    getTeamMembers(projectId: string, teamId: string, top?: number, skip?: number): Promise<VSSInterfaces.IdentityRef[]>;
    getProcessById(processId: string): Promise<CoreInterfaces.Process>;
    getProcesses(): Promise<CoreInterfaces.Process[]>;
    getProjectCollection(collectionId: string): Promise<CoreInterfaces.TeamProjectCollection>;
    getProjectCollections(top?: number, skip?: number): Promise<CoreInterfaces.TeamProjectCollectionReference[]>;
    getProjectHistory(minRevision?: number): Promise<CoreInterfaces.TeamProjectReference[]>;
    getProject(projectId: string, includeCapabilities?: boolean, includeHistory?: boolean): Promise<CoreInterfaces.TeamProject>;
    getProjects(stateFilter?: any, top?: number, skip?: number): Promise<CoreInterfaces.TeamProjectReference[]>;
    queueCreateProject(projectToCreate: CoreInterfaces.TeamProject): Promise<OperationsInterfaces.OperationReference>;
    queueDeleteProject(projectId: string): Promise<OperationsInterfaces.OperationReference>;
    updateProject(projectUpdate: CoreInterfaces.TeamProject, projectId: string): Promise<OperationsInterfaces.OperationReference>;
    createOrUpdateProxy(proxy: CoreInterfaces.Proxy): Promise<CoreInterfaces.Proxy>;
    deleteProxy(proxyUrl: string, site?: string): Promise<void>;
    getProxies(proxyUrl?: string): Promise<CoreInterfaces.Proxy[]>;
    createTeam(team: CoreInterfaces.WebApiTeam, projectId: string): Promise<CoreInterfaces.WebApiTeam>;
    deleteTeam(projectId: string, teamId: string): Promise<void>;
    getTeam(projectId: string, teamId: string): Promise<CoreInterfaces.WebApiTeam>;
    getTeams(projectId: string, top?: number, skip?: number): Promise<CoreInterfaces.WebApiTeam[]>;
    updateTeam(teamData: CoreInterfaces.WebApiTeam, projectId: string, teamId: string): Promise<CoreInterfaces.WebApiTeam>;
}

export class CoreApi extends basem.ClientApiBase implements ICoreApi {
    constructor(baseUrl: string, handlers: VsoBaseInterfaces.IRequestHandler[], options?: VsoBaseInterfaces.IRequestOptions) {
        super(baseUrl, handlers, 'node-Core-api', options);
    }

    /**
    * @param {CoreInterfaces.WebApiConnectedServiceDetails} connectedServiceCreationData
    * @param {string} projectId
    */
    public async createConnectedService(
        connectedServiceCreationData: CoreInterfaces.WebApiConnectedServiceDetails,
        projectId: string
    ): Promise<CoreInterfaces.WebApiConnectedService> {

        return new Promise<CoreInterfaces.WebApiConnectedService>(async (resolve, reject) => {
            let routeValues: any = {
                projectId: projectId
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.1",
                    "core",
                    "b4f70219-e18b-42c5-abe3-98b07d35525e",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json',
                    verData.apiVersion);

                let res: restm.IRestResponse<CoreInterfaces.WebApiConnectedService>;
                res = await this.rest.create<CoreInterfaces.WebApiConnectedService>(url, connectedServiceCreationData, options);

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
    * @param {string} projectId
    * @param {string} name
    */
    public async getConnectedServiceDetails(
        projectId: string,
        name: string
    ): Promise<CoreInterfaces.WebApiConnectedServiceDetails> {

        return new Promise<CoreInterfaces.WebApiConnectedServiceDetails>(async (resolve, reject) => {
            let routeValues: any = {
                projectId: projectId,
                name: name
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.1",
                    "core",
                    "b4f70219-e18b-42c5-abe3-98b07d35525e",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json',
                    verData.apiVersion);

                let res: restm.IRestResponse<CoreInterfaces.WebApiConnectedServiceDetails>;
                res = await this.rest.get<CoreInterfaces.WebApiConnectedServiceDetails>(url, options);

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
    * @param {string} projectId
    * @param {CoreInterfaces.ConnectedServiceKind} kind
    */
    public async getConnectedServices(
        projectId: string,
        kind?: CoreInterfaces.ConnectedServiceKind
    ): Promise<CoreInterfaces.WebApiConnectedService[]> {

        return new Promise<CoreInterfaces.WebApiConnectedService[]>(async (resolve, reject) => {
            let routeValues: any = {
                projectId: projectId
            };

            let queryValues: any = {
                kind: kind,
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.1",
                    "core",
                    "b4f70219-e18b-42c5-abe3-98b07d35525e",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json',
                    verData.apiVersion);

                let res: restm.IRestResponse<CoreInterfaces.WebApiConnectedService[]>;
                res = await this.rest.get<CoreInterfaces.WebApiConnectedService[]>(url, options);

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
    * @param {CoreInterfaces.IdentityData} mruData
    * @param {string} mruName
    */
    public async createIdentityMru(
        mruData: CoreInterfaces.IdentityData,
        mruName: string
    ): Promise<void> {

        return new Promise<void>(async (resolve, reject) => {
            let routeValues: any = {
                mruName: mruName
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.1",
                    "core",
                    "5ead0b70-2572-4697-97e9-f341069a783a",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json',
                    verData.apiVersion);

                let res: restm.IRestResponse<void>;
                res = await this.rest.create<void>(url, mruData, options);

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
    * @param {CoreInterfaces.IdentityData} mruData
    * @param {string} mruName
    */
    public async deleteIdentityMru(
        mruData: CoreInterfaces.IdentityData,
        mruName: string
    ): Promise<void> {

        return new Promise<void>(async (resolve, reject) => {
            let routeValues: any = {
                mruName: mruName
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.1",
                    "core",
                    "5ead0b70-2572-4697-97e9-f341069a783a",
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
    * @param {string} mruName
    */
    public async getIdentityMru(
        mruName: string
    ): Promise<VSSInterfaces.IdentityRef[]> {

        return new Promise<VSSInterfaces.IdentityRef[]>(async (resolve, reject) => {
            let routeValues: any = {
                mruName: mruName
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.1",
                    "core",
                    "5ead0b70-2572-4697-97e9-f341069a783a",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json',
                    verData.apiVersion);

                let res: restm.IRestResponse<VSSInterfaces.IdentityRef[]>;
                res = await this.rest.get<VSSInterfaces.IdentityRef[]>(url, options);

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
    * @param {CoreInterfaces.IdentityData} mruData
    * @param {string} mruName
    */
    public async updateIdentityMru(
        mruData: CoreInterfaces.IdentityData,
        mruName: string
    ): Promise<void> {

        return new Promise<void>(async (resolve, reject) => {
            let routeValues: any = {
                mruName: mruName
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.1",
                    "core",
                    "5ead0b70-2572-4697-97e9-f341069a783a",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json',
                    verData.apiVersion);

                let res: restm.IRestResponse<void>;
                res = await this.rest.update<void>(url, mruData, options);

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
    * @param {string} projectId
    * @param {string} teamId
    * @param {number} top
    * @param {number} skip
    */
    public async getTeamMembers(
        projectId: string,
        teamId: string,
        top?: number,
        skip?: number
    ): Promise<VSSInterfaces.IdentityRef[]> {

        return new Promise<VSSInterfaces.IdentityRef[]>(async (resolve, reject) => {
            let routeValues: any = {
                projectId: projectId,
                teamId: teamId
            };

            let queryValues: any = {
                '$top': top,
                '$skip': skip,
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.1",
                    "core",
                    "294c494c-2600-4d7e-b76c-3dd50c3c95be",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json',
                    verData.apiVersion);

                let res: restm.IRestResponse<VSSInterfaces.IdentityRef[]>;
                res = await this.rest.get<VSSInterfaces.IdentityRef[]>(url, options);

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
    * Retrieve process by id
    * 
    * @param {string} processId
    */
    public async getProcessById(
        processId: string
    ): Promise<CoreInterfaces.Process> {

        return new Promise<CoreInterfaces.Process>(async (resolve, reject) => {
            let routeValues: any = {
                processId: processId
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.1",
                    "core",
                    "93878975-88c5-4e6a-8abb-7ddd77a8a7d8",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json',
                    verData.apiVersion);

                let res: restm.IRestResponse<CoreInterfaces.Process>;
                res = await this.rest.get<CoreInterfaces.Process>(url, options);

                let ret = this.formatResponse(res.result,
                    CoreInterfaces.TypeInfo.Process,
                    false);

                resolve(ret);

            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
    */
    public async getProcesses(
    ): Promise<CoreInterfaces.Process[]> {

        return new Promise<CoreInterfaces.Process[]>(async (resolve, reject) => {
            let routeValues: any = {
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.1",
                    "core",
                    "93878975-88c5-4e6a-8abb-7ddd77a8a7d8",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json',
                    verData.apiVersion);

                let res: restm.IRestResponse<CoreInterfaces.Process[]>;
                res = await this.rest.get<CoreInterfaces.Process[]>(url, options);

                let ret = this.formatResponse(res.result,
                    CoreInterfaces.TypeInfo.Process,
                    true);

                resolve(ret);

            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
    * Get project collection with the specified id or name.
    * 
    * @param {string} collectionId
    */
    public async getProjectCollection(
        collectionId: string
    ): Promise<CoreInterfaces.TeamProjectCollection> {

        return new Promise<CoreInterfaces.TeamProjectCollection>(async (resolve, reject) => {
            let routeValues: any = {
                collectionId: collectionId
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "core",
                    "8031090f-ef1d-4af6-85fc-698cd75d42bf",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json',
                    verData.apiVersion);

                let res: restm.IRestResponse<CoreInterfaces.TeamProjectCollection>;
                res = await this.rest.get<CoreInterfaces.TeamProjectCollection>(url, options);

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
    * Get project collection references for this application.
    * 
    * @param {number} top
    * @param {number} skip
    */
    public async getProjectCollections(
        top?: number,
        skip?: number
    ): Promise<CoreInterfaces.TeamProjectCollectionReference[]> {

        return new Promise<CoreInterfaces.TeamProjectCollectionReference[]>(async (resolve, reject) => {
            let routeValues: any = {
            };

            let queryValues: any = {
                '$top': top,
                '$skip': skip,
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "core",
                    "8031090f-ef1d-4af6-85fc-698cd75d42bf",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json',
                    verData.apiVersion);

                let res: restm.IRestResponse<CoreInterfaces.TeamProjectCollectionReference[]>;
                res = await this.rest.get<CoreInterfaces.TeamProjectCollectionReference[]>(url, options);

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
    * @param {number} minRevision
    */
    public async getProjectHistory(
        minRevision?: number
    ): Promise<CoreInterfaces.TeamProjectReference[]> {

        return new Promise<CoreInterfaces.TeamProjectReference[]>(async (resolve, reject) => {
            let routeValues: any = {
            };

            let queryValues: any = {
                minRevision: minRevision,
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.1",
                    "core",
                    "6488a877-4749-4954-82ea-7340d36be9f2",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json',
                    verData.apiVersion);

                let res: restm.IRestResponse<CoreInterfaces.TeamProjectReference[]>;
                res = await this.rest.get<CoreInterfaces.TeamProjectReference[]>(url, options);

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
    * Get project with the specified id or name, optionally including capabilities.
    * 
    * @param {string} projectId
    * @param {boolean} includeCapabilities - Include capabilities (such as source control) in the team project result (default: false).
    * @param {boolean} includeHistory - Search within renamed projects (that had such name in the past).
    */
    public async getProject(
        projectId: string,
        includeCapabilities?: boolean,
        includeHistory?: boolean
    ): Promise<CoreInterfaces.TeamProject> {

        return new Promise<CoreInterfaces.TeamProject>(async (resolve, reject) => {
            let routeValues: any = {
                projectId: projectId
            };

            let queryValues: any = {
                includeCapabilities: includeCapabilities,
                includeHistory: includeHistory,
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.3",
                    "core",
                    "603fe2ac-9723-48b9-88ad-09305aa6c6e1",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json',
                    verData.apiVersion);

                let res: restm.IRestResponse<CoreInterfaces.TeamProject>;
                res = await this.rest.get<CoreInterfaces.TeamProject>(url, options);

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
    * Get project references with the specified state
    * 
    * @param {any} stateFilter - Filter on team projects in a specific team project state (default: WellFormed).
    * @param {number} top
    * @param {number} skip
    */
    public async getProjects(
        stateFilter?: any,
        top?: number,
        skip?: number
    ): Promise<CoreInterfaces.TeamProjectReference[]> {

        return new Promise<CoreInterfaces.TeamProjectReference[]>(async (resolve, reject) => {
            let routeValues: any = {
            };

            let queryValues: any = {
                stateFilter: stateFilter,
                '$top': top,
                '$skip': skip,
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.3",
                    "core",
                    "603fe2ac-9723-48b9-88ad-09305aa6c6e1",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json',
                    verData.apiVersion);

                let res: restm.IRestResponse<CoreInterfaces.TeamProjectReference[]>;
                res = await this.rest.get<CoreInterfaces.TeamProjectReference[]>(url, options);

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
    * Queue a project creation.
    * 
    * @param {CoreInterfaces.TeamProject} projectToCreate - The project to create.
    */
    public async queueCreateProject(
        projectToCreate: CoreInterfaces.TeamProject
    ): Promise<OperationsInterfaces.OperationReference> {

        return new Promise<OperationsInterfaces.OperationReference>(async (resolve, reject) => {
            let routeValues: any = {
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.3",
                    "core",
                    "603fe2ac-9723-48b9-88ad-09305aa6c6e1",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json',
                    verData.apiVersion);

                let res: restm.IRestResponse<OperationsInterfaces.OperationReference>;
                res = await this.rest.create<OperationsInterfaces.OperationReference>(url, projectToCreate, options);

                let ret = this.formatResponse(res.result,
                    OperationsInterfaces.TypeInfo.OperationReference,
                    false);

                resolve(ret);

            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
    * Queue a project deletion.
    * 
    * @param {string} projectId - The project id of the project to delete.
    */
    public async queueDeleteProject(
        projectId: string
    ): Promise<OperationsInterfaces.OperationReference> {

        return new Promise<OperationsInterfaces.OperationReference>(async (resolve, reject) => {
            let routeValues: any = {
                projectId: projectId
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.3",
                    "core",
                    "603fe2ac-9723-48b9-88ad-09305aa6c6e1",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json',
                    verData.apiVersion);

                let res: restm.IRestResponse<OperationsInterfaces.OperationReference>;
                res = await this.rest.del<OperationsInterfaces.OperationReference>(url, options);

                let ret = this.formatResponse(res.result,
                    OperationsInterfaces.TypeInfo.OperationReference,
                    false);

                resolve(ret);

            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
    * Update an existing project's name, abbreviation, or description.
    * 
    * @param {CoreInterfaces.TeamProject} projectUpdate - The updates for the project.
    * @param {string} projectId - The project id of the project to update.
    */
    public async updateProject(
        projectUpdate: CoreInterfaces.TeamProject,
        projectId: string
    ): Promise<OperationsInterfaces.OperationReference> {

        return new Promise<OperationsInterfaces.OperationReference>(async (resolve, reject) => {
            let routeValues: any = {
                projectId: projectId
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.3",
                    "core",
                    "603fe2ac-9723-48b9-88ad-09305aa6c6e1",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json',
                    verData.apiVersion);

                let res: restm.IRestResponse<OperationsInterfaces.OperationReference>;
                res = await this.rest.update<OperationsInterfaces.OperationReference>(url, projectUpdate, options);

                let ret = this.formatResponse(res.result,
                    OperationsInterfaces.TypeInfo.OperationReference,
                    false);

                resolve(ret);

            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
    * @param {CoreInterfaces.Proxy} proxy
    */
    public async createOrUpdateProxy(
        proxy: CoreInterfaces.Proxy
    ): Promise<CoreInterfaces.Proxy> {

        return new Promise<CoreInterfaces.Proxy>(async (resolve, reject) => {
            let routeValues: any = {
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "core",
                    "ec1f4311-f2b4-4c15-b2b8-8990b80d2908",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json',
                    verData.apiVersion);

                let res: restm.IRestResponse<CoreInterfaces.Proxy>;
                res = await this.rest.replace<CoreInterfaces.Proxy>(url, proxy, options);

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
    * @param {string} proxyUrl
    * @param {string} site
    */
    public async deleteProxy(
        proxyUrl: string,
        site?: string
    ): Promise<void> {

        return new Promise<void>(async (resolve, reject) => {
            let routeValues: any = {
            };

            let queryValues: any = {
                proxyUrl: proxyUrl,
                site: site,
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "core",
                    "ec1f4311-f2b4-4c15-b2b8-8990b80d2908",
                    routeValues,
                    queryValues);

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
    * @param {string} proxyUrl
    */
    public async getProxies(
        proxyUrl?: string
    ): Promise<CoreInterfaces.Proxy[]> {

        return new Promise<CoreInterfaces.Proxy[]>(async (resolve, reject) => {
            let routeValues: any = {
            };

            let queryValues: any = {
                proxyUrl: proxyUrl,
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.2",
                    "core",
                    "ec1f4311-f2b4-4c15-b2b8-8990b80d2908",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json',
                    verData.apiVersion);

                let res: restm.IRestResponse<CoreInterfaces.Proxy[]>;
                res = await this.rest.get<CoreInterfaces.Proxy[]>(url, options);

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
    * Creates a team
    * 
    * @param {CoreInterfaces.WebApiTeam} team - The team data used to create the team.
    * @param {string} projectId - The name or id (GUID) of the team project in which to create the team.
    */
    public async createTeam(
        team: CoreInterfaces.WebApiTeam,
        projectId: string
    ): Promise<CoreInterfaces.WebApiTeam> {

        return new Promise<CoreInterfaces.WebApiTeam>(async (resolve, reject) => {
            let routeValues: any = {
                projectId: projectId
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.1",
                    "core",
                    "d30a3dd1-f8ba-442a-b86a-bd0c0c383e59",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json',
                    verData.apiVersion);

                let res: restm.IRestResponse<CoreInterfaces.WebApiTeam>;
                res = await this.rest.create<CoreInterfaces.WebApiTeam>(url, team, options);

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
    * Deletes a team
    * 
    * @param {string} projectId - The name or id (GUID) of the team project containing the team to delete.
    * @param {string} teamId - The name of id of the team to delete.
    */
    public async deleteTeam(
        projectId: string,
        teamId: string
    ): Promise<void> {

        return new Promise<void>(async (resolve, reject) => {
            let routeValues: any = {
                projectId: projectId,
                teamId: teamId
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.1",
                    "core",
                    "d30a3dd1-f8ba-442a-b86a-bd0c0c383e59",
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
    * Gets a team
    * 
    * @param {string} projectId
    * @param {string} teamId
    */
    public async getTeam(
        projectId: string,
        teamId: string
    ): Promise<CoreInterfaces.WebApiTeam> {

        return new Promise<CoreInterfaces.WebApiTeam>(async (resolve, reject) => {
            let routeValues: any = {
                projectId: projectId,
                teamId: teamId
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.1",
                    "core",
                    "d30a3dd1-f8ba-442a-b86a-bd0c0c383e59",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json',
                    verData.apiVersion);

                let res: restm.IRestResponse<CoreInterfaces.WebApiTeam>;
                res = await this.rest.get<CoreInterfaces.WebApiTeam>(url, options);

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
    * @param {string} projectId
    * @param {number} top
    * @param {number} skip
    */
    public async getTeams(
        projectId: string,
        top?: number,
        skip?: number
    ): Promise<CoreInterfaces.WebApiTeam[]> {

        return new Promise<CoreInterfaces.WebApiTeam[]>(async (resolve, reject) => {
            let routeValues: any = {
                projectId: projectId
            };

            let queryValues: any = {
                '$top': top,
                '$skip': skip,
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.1",
                    "core",
                    "d30a3dd1-f8ba-442a-b86a-bd0c0c383e59",
                    routeValues,
                    queryValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json',
                    verData.apiVersion);

                let res: restm.IRestResponse<CoreInterfaces.WebApiTeam[]>;
                res = await this.rest.get<CoreInterfaces.WebApiTeam[]>(url, options);

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
    * Updates a team's name and/or description
    * 
    * @param {CoreInterfaces.WebApiTeam} teamData
    * @param {string} projectId - The name or id (GUID) of the team project containing the team to update.
    * @param {string} teamId - The name of id of the team to update.
    */
    public async updateTeam(
        teamData: CoreInterfaces.WebApiTeam,
        projectId: string,
        teamId: string
    ): Promise<CoreInterfaces.WebApiTeam> {

        return new Promise<CoreInterfaces.WebApiTeam>(async (resolve, reject) => {
            let routeValues: any = {
                projectId: projectId,
                teamId: teamId
            };

            try {
                let verData: vsom.ClientVersioningData = await this.vsoClient.getVersioningData(
                    "3.2-preview.1",
                    "core",
                    "d30a3dd1-f8ba-442a-b86a-bd0c0c383e59",
                    routeValues);

                let url: string = verData.requestUrl;
                let options: restm.IRequestOptions = this.createRequestOptions('application/json',
                    verData.apiVersion);

                let res: restm.IRestResponse<CoreInterfaces.WebApiTeam>;
                res = await this.rest.update<CoreInterfaces.WebApiTeam>(url, teamData, options);

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

}
