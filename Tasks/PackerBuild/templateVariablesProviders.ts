"use strict";

import * as path from "path";
import * as tl from "vsts-task-lib/task";
import * as ptm from "./packerTemplateManager";
import packerHost from "./packerHost";

export class TaskInputVariablesProvider implements ptm.ITemplateVariablesProvider {

    constructor() {
        //this._taskInputVariables = new Map<string, string>();
    }

    public register(packerHost: packerHost): void {
        packerHost.templateManager.registerTemplateVariablesProvider(ptm.VariablesProviderTypes.TaskInput, this);
    }

    public getTemplateVariables(osType: string): Map<string, string> {
        if(!!this._taskInputVariables) {
            return this._taskInputVariables;
        }

        this._taskInputVariables = new Map<string, string>();
        this._taskInputVariables.set("resource_group", tl.getInput("azureResourceGroup", true));
        this._taskInputVariables.set("storage_account", tl.getInput("azureStorageAccount", true));
        this._taskInputVariables.set("image_publisher", tl.getInput("imagePublisher", true));
        this._taskInputVariables.set("image_offer", tl.getInput("imageOffer", true));
        this._taskInputVariables.set("image_sku", tl.getInput("imageSku", true));
        this._taskInputVariables.set("location", tl.getInput("location", true));
        
        var deployScriptPath = tl.getInput("deployScriptPath", true);
        var packagePath = tl.getInput("packagePath", true);
        this._taskInputVariables.set("script_path", deployScriptPath);
        this._taskInputVariables.set("script_name", path.basename(deployScriptPath));
        this._taskInputVariables.set("package_path", packagePath);
        this._taskInputVariables.set("package_name", path.basename(packagePath));
        
        return this._taskInputVariables;
    }

    private _taskInputVariables: Map<string, string>;
}

export class AzureSpnVariablesProvider implements ptm.ITemplateVariablesProvider {

    constructor() {
        //this._taskInputVariables = new Map<string, string>();
    }

    public register(packerHost: packerHost): void {
        packerHost.templateManager.registerTemplateVariablesProvider(ptm.VariablesProviderTypes.AzureSPN, this);
    }

    public getTemplateVariables(osType: string): Map<string, string> {
        if(!!this._spnVariables) {
            return this._spnVariables;
        }

        this._spnVariables = new Map<string, string>();
        var connectedService = tl.getInput("ConnectedServiceName", true);
        var endpointAuth = tl.getEndpointAuthorization(connectedService, true);
        this._spnVariables.set("subscription_id", tl.getEndpointDataParameter(connectedService, "SubscriptionId", true));
        this._spnVariables.set("client_id", endpointAuth.parameters["serviceprincipalid"]);
        this._spnVariables.set("client_secret", endpointAuth.parameters["serviceprincipalkey"]);
        this._spnVariables.set("tenant_id", endpointAuth.parameters["tenantid"]);
        this._spnVariables.set("object_id", tl.getEndpointDataParameter(connectedService, "spnObjectId", true));        
        
        return this._spnVariables;
    }

    private _spnVariables: Map<string, string>;
}