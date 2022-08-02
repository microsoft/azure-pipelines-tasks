"use strict";

import * as tl from "azure-pipelines-task-lib/task";
import * as constants from "./constants";
import * as definitions from "./definitions"

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
        var connectedService = taskParameters.serviceEndpoint;

        // if custom template is used, SPN variables are not required
        if(taskParameters.templateType === constants.TemplateTypeCustom && !connectedService) {
            this._spnVariables = new Map<string, string>();
            return this._spnVariables;
        }

        this._spnVariables = new Map<string, string>();
        var subscriptionId: string = tl.getEndpointDataParameter(connectedService, "SubscriptionId", true)
        this._spnVariables.set(constants.TemplateVariableSubscriptionIdName, subscriptionId);
        this._spnVariables.set(constants.TemplateVariableClientIdName, tl.getEndpointAuthorizationParameter(connectedService, 'serviceprincipalid', false));
        this._spnVariables.set(constants.TemplateVariableClientSecretName, tl.getEndpointAuthorizationParameter(connectedService, 'serviceprincipalkey', false));
        this._spnVariables.set(constants.TemplateVariableTenantIdName, tl.getEndpointAuthorizationParameter(connectedService, 'tenantid', false));

        return this._spnVariables;
    }

    private _spnVariables: Map<string, string>;
}