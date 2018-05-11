"use strict";

import azureGraph = require('azure-arm-rest/azure-graph');
import msRestAzure = require("azure-arm-rest/azure-arm-common");

import * as tl from "vsts-task-lib/task";
import * as constants from "./constants";
import * as definitions from "./definitions"
import TaskParameters from "./taskParameters"

// Provider for all template variables related to azure SPN. Reads service endpoint to get all necessary details.
export default class AzureSpnTemplateVariablesProvider implements definitions.ITemplateVariablesProvider {

    public register(packerHost: definitions.IPackerHost): void {
        packerHost.registerTemplateVariablesProvider(definitions.VariablesProviderTypes.AzureSPN, this);
        tl.debug("registered SPN variables provider");
    }

    public async getTemplateVariables(packerHost: definitions.IPackerHost): Promise<Map<string, string>> {
        if(!!this._spnVariables) {
            return this._spnVariables;
        }

        var taskParameters = packerHost.getTaskParameters();

        // if custom template is used, SPN variables are not required
        if(taskParameters.templateType === constants.TemplateTypeCustom) {
            this._spnVariables = new Map<string, string>();
            return this._spnVariables;
        }

        this._spnVariables = new Map<string, string>();
        var connectedService = taskParameters.serviceEndpoint;
        var subscriptionId: string = tl.getEndpointDataParameter(connectedService, "SubscriptionId", true)
        this._spnVariables.set(constants.TemplateVariableSubscriptionIdName, subscriptionId);
        this._spnVariables.set(constants.TemplateVariableClientIdName, tl.getEndpointAuthorizationParameter(connectedService, 'serviceprincipalid', false));
        this._spnVariables.set(constants.TemplateVariableClientSecretName, tl.getEndpointAuthorizationParameter(connectedService, 'serviceprincipalkey', false));
        this._spnVariables.set(constants.TemplateVariableTenantIdName, tl.getEndpointAuthorizationParameter(connectedService, 'tenantid', false));


        var spnObjectId = tl.getEndpointDataParameter(connectedService, "spnObjectId", true);
        // if we are creating windows VM and SPN object-id is not available in service endpoint, fetch it from Graph endpoint
        // NOP for nix
        if(!spnObjectId && taskParameters.osType.toLowerCase().match(/^win/)) {
            spnObjectId = await this.getServicePrincipalObjectId(taskParameters.graphCredentials);
        }

        this._spnVariables.set(constants.TemplateVariableObjectIdName, spnObjectId);

        return this._spnVariables;
    }

    private async getServicePrincipalObjectId(graphCredentials: msRestAzure.ApplicationTokenCredentials): Promise<string> {
        console.log(tl.loc("FetchingSPNDetailsRemotely", graphCredentials.getClientId()));
        var client = new azureGraph.GraphManagementClient(graphCredentials);
        var servicePrincipal = null;
        try {
            servicePrincipal = await client.servicePrincipals.GetServicePrincipal(null);
        } catch (error) {
            throw tl.loc("FailedToFetchSPNDetailsRemotely", error.message);
        }

        var spnObjectId: string = "";
        if(!!servicePrincipal && !!servicePrincipal.objectId) {
            spnObjectId = servicePrincipal.objectId;
        }

        console.log(tl.loc("FetchedSPNDetailsRemotely", spnObjectId));
        return spnObjectId;
    }

    private _spnVariables: Map<string, string>;
}