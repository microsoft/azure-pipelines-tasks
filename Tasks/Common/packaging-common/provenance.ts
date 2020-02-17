import * as tl from 'azure-pipelines-task-lib';

import * as VsoBaseInterfaces from 'azure-devops-node-api/interfaces/common/VsoBaseInterfaces';
import { ClientVersioningData } from 'azure-devops-node-api/VsoClient';
import vstsClientBases = require('azure-devops-node-api/ClientApiBases');
import { logError, LogType } from './util';

import * as restclient from 'typed-rest-client/RestClient';

export interface SessionRequest {
    /**
     * Generic property bag to store data about the session
     */
    data: { [key: string] : string; };
    /**
     * The feed name or id for the session
     */
    feed: string;
    /**
     * The type of session If a known value is provided, the Data dictionary will be validated for the presence of properties required by that type
     */
    source: string;
}

export interface SessionResponse {
    /**
     * The identifier for the session
     */
    sessionId: string;
}

export class ProvenanceHelper {
    /* Creates a session request with default data provided by the build variables */
    public static CreateSessionRequest(feedId: string): SessionRequest {

        var releaseId = tl.getVariable("Release.ReleaseId");
        if (releaseId != null) {
            return ProvenanceHelper.CreateReleaseSessionRequest(feedId, releaseId);
        }

        var buildId = tl.getVariable("Build.BuildId");
        if (buildId != null) {
            return ProvenanceHelper.CreateBuildSessionRequest(feedId, buildId);
        }

        throw new Error("Could not resolve Release.ReleaseId or Build.BuildId");
    }

    public static async GetSessionId(
        feedId: string,
        project: string,
        protocol: string,
        baseUrl: string,
        handlers: VsoBaseInterfaces.IRequestHandler[],
        options: VsoBaseInterfaces.IRequestOptions): Promise<string> {
               
        const publishPackageMetadata = tl.getInput("publishPackageMetadata");
        let shouldCreateSession = publishPackageMetadata && publishPackageMetadata.toLowerCase() == 'true';
        if (shouldCreateSession) {
            const useSessionEnabled = tl.getVariable("Packaging.SavePublishMetadata");
            shouldCreateSession = shouldCreateSession && !(useSessionEnabled && useSessionEnabled.toLowerCase() == 'false')
        }
        if (shouldCreateSession) {
            tl.debug("Creating provenance session to save pipeline metadata. This can be disabled in the task settings, or by setting build variable Packaging.SavePublishMetadata to false");
            const prov = new ProvenanceApi(baseUrl, handlers, options);
            const sessionRequest = ProvenanceHelper.CreateSessionRequest(feedId);
            try {
                const session = await prov.createSession(sessionRequest, protocol, project);
                return session.sessionId;
            } catch (error) {
                tl.warning(tl.loc("Warning_SessionCreationFailed"));
                logError(error, LogType.warning);
            }
        }
        return feedId;
    }

    private static CreateReleaseSessionRequest(feedId: string, releaseId: string): SessionRequest {
        let releaseData = {
            "System.CollectionId": tl.getVariable("System.CollectionId"),
            "System.TeamProjectId": tl.getVariable("System.TeamProjectId"),
            "Release.ReleaseId": releaseId,
            "Release.ReleaseName": tl.getVariable("Release.ReleaseName"),
            "Release.DefinitionName": tl.getVariable("Release.DefinitionName"),
            "Release.DefinitionId": tl.getVariable("Release.DefinitionId")
        }

        var sessionRequest: SessionRequest = { 
            feed: feedId,
            source: "InternalRelease",
            data: releaseData
        }

        return sessionRequest;
    }

    private static CreateBuildSessionRequest(feedId: string, buildId: string): SessionRequest {
        let buildData = {
            "System.CollectionId": tl.getVariable("System.CollectionId"),
            "System.DefinitionId": tl.getVariable("System.DefinitionId"),
            "System.TeamProjectId": tl.getVariable("System.TeamProjectId"),
            "Build.BuildId": buildId,
            "Build.BuildNumber": tl.getVariable("Build.BuildNumber"),
            "Build.DefinitionName": tl.getVariable("Build.DefinitionName"),
            "Build.Repository.Name": tl.getVariable("Build.Repository.Name"),
            "Build.Repository.Provider": tl.getVariable("Build.Repository.Provider"),
            "Build.Repository.Id": tl.getVariable("Build.Repository.Id"),
            "Build.Repository.Uri": tl.getVariable("Build.Repository.Uri"),
            "Build.SourceBranch": tl.getVariable("Build.SourceBranch"),
            "Build.SourceBranchName": tl.getVariable("Build.SourceBranchName"),
            "Build.SourceVersion": tl.getVariable("Build.SourceVersion")
        }

        var sessionRequest: SessionRequest = { 
            feed: feedId,
            source: "InternalBuild",
            data: buildData
        }

        return sessionRequest;
    }
}

class ProvenanceApi extends vstsClientBases.ClientApiBase {
    constructor(baseUrl: string, handlers: VsoBaseInterfaces.IRequestHandler[], options?: VsoBaseInterfaces.IRequestOptions) {
        super(baseUrl, handlers, "node-packageprovenance-api", options);
    }

    /**
     * Creates a session, a wrapper around a feed that can store additional metadata on the packages published to the session.
     * 
     * @param {SessionRequest} sessionRequest - The feed and metadata for the session
     * @param {string} protocol - The protocol that the session will target
     */
    public async createSession(
        sessionRequest: SessionRequest,
        protocol: string,
        project: string
        ): Promise<SessionResponse> {

        return new Promise<SessionResponse>(async (resolve, reject) => {

            let routeValues: any = {
                protocol: protocol,
                project: project
            };

            try {
                let verData: ClientVersioningData = await this.vsoClient.getVersioningData(
                    "5.0-preview.1",
                    "Provenance",
                    "503B4E54-EBF4-4D04-8EEE-21C00823C2AC",
                    routeValues);

                let url: string = verData.requestUrl;

                let options: restclient.IRequestOptions = this.createRequestOptions('application/json', 
                                                                                verData.apiVersion);

                let res: restclient.IRestResponse<SessionResponse>;
                res = await this.rest.create<SessionResponse>(url, sessionRequest, options);
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

