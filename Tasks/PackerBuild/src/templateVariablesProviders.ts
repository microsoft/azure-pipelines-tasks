"use strict";

import * as path from "path";
import * as tl from "vsts-task-lib/task";
import * as ptm from "./packerTemplateManager";
import packerHost from "./packerHost";
import * as constants from "./constants"

// provider for all variables which are derived from task input(aprt from azure subscription input which is read by AzureSpnVariablesProvider)
export class TaskInputVariablesProvider implements ptm.ITemplateVariablesProvider {

    public register(packerHost: packerHost): void {
        packerHost.templateManager.registerTemplateVariablesProvider(ptm.VariablesProviderTypes.TaskInput, this);
        tl.debug("registered task input variables provider");        
    }

    public getTemplateVariables(osType: string): Map<string, string> {
        if(!!this._taskInputVariables) {
            return this._taskInputVariables;
        }

        // VM specific variables
        this._taskInputVariables = new Map<string, string>();
        this._taskInputVariables.set(constants.TemplateVariableResourceGroupName, tl.getInput(constants.ResourceGroupInputName, true));
        this._taskInputVariables.set(constants.TemplateVariableStorageAccountName, tl.getInput(constants.StorageAccountInputName, true));
        this._taskInputVariables.set(constants.TemplateVariableImagePublisherName, tl.getInput(constants.ImagePublisherInputName, true));
        this._taskInputVariables.set(constants.TemplateVariableImageOfferName, tl.getInput(constants.ImageOfferInputName, true));
        this._taskInputVariables.set(constants.TemplateVariableImageSkuName, tl.getInput(constants.ImageSkuInputName, true));
        this._taskInputVariables.set(constants.TemplateVariableLocationName, tl.getInput(constants.LocationInputName, true));
        
        // user deployment script specific variables
        var deployScriptPath = tl.getInput(constants.DeployScriptPathInputName, true);
        var packagePath = tl.getInput(constants.DeployPackageInputName, true);
        this._taskInputVariables.set(constants.TemplateVariableScriptPathName, deployScriptPath);
        this._taskInputVariables.set(constants.TemplateVariableScriptName, path.basename(deployScriptPath));
        this._taskInputVariables.set(constants.TemplateVariablePackagePathName, packagePath);
        this._taskInputVariables.set(constants.TemplateVariablePackageName, path.basename(packagePath));
        
        return this._taskInputVariables;
    }

    private _taskInputVariables: Map<string, string>;
}

// Provider for all variables related to azure SPN. Reads service endpoint to get all necessary details.
export class AzureSpnVariablesProvider implements ptm.ITemplateVariablesProvider {

    public register(packerHost: packerHost): void {     
        packerHost.templateManager.registerTemplateVariablesProvider(ptm.VariablesProviderTypes.AzureSPN, this);
        tl.debug("registered SPN variables provider");        
    }

    public getTemplateVariables(osType: string): Map<string, string> {
        if(!!this._spnVariables) {
            return this._spnVariables;
        }

        this._spnVariables = new Map<string, string>();
        var connectedService = tl.getInput(constants.ConnectedServiceInputName, true);
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