"use strict";

import * as tl from "vsts-task-lib/task";
import * as constants from "./constants";
import * as definitions from "./definitions"

// Provider for all template variables related to azure SPN. Reads service endpoint to get all necessary details.
export default class AzureSpnTemplateVariablesProvider implements definitions.ITemplateVariablesProvider {

    public register(packerHost: definitions.IPackerHost): void {     
        packerHost.registerTemplateVariablesProvider(definitions.VariablesProviderTypes.AzureSPN, this);
        tl.debug("registered SPN variables provider");        
    }

    public getTemplateVariables(packerHost: definitions.IPackerHost): Map<string, string> {
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
        var endpointAuth = tl.getEndpointAuthorization(connectedService, true);
        this._spnVariables.set(constants.TemplateVariableSubscriptionIdName, tl.getEndpointDataParameter(connectedService, "SubscriptionId", true));
        this._spnVariables.set(constants.TemplateVariableClientIdName, endpointAuth.parameters["serviceprincipalid"]);
        this._spnVariables.set(constants.TemplateVariableClientSecretName, endpointAuth.parameters["serviceprincipalkey"]);
        this._spnVariables.set(constants.TemplateVariableTenantIdName, endpointAuth.parameters["tenantid"]);
        this._spnVariables.set(constants.TemplateVariableObjectIdName, tl.getEndpointDataParameter(connectedService, "spnObjectId", true));        
        
        return this._spnVariables;
    }

    private _spnVariables: Map<string, string>;
}