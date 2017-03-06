"use strict";

import * as path from "path";
import * as tl from "vsts-task-lib/task";
import packerHost from "./packerHost";
import * as constants from "./constants";
import * as definitions from "./definitions"

// provider for all template variables which are derived from task input(apart from azure subscription input which is read by AzureSpnVariablesProvider)
export default class TaskInputTemplateVariablesProvider implements definitions.ITemplateVariablesProvider {

    constructor() {
    }

    public register(packerHost: packerHost): void {
        packerHost.registerTemplateVariablesProvider(definitions.VariablesProviderTypes.TaskInput, this);
        tl.debug("registered task input variables provider");        
    }

    public getTemplateVariables(): Map<string, string> {
        if(!!this._templateVariables) {
            return this._templateVariables;
        }

        // VM specific variables
        this._templateVariables = new Map<string, string>();
        this._templateVariables.set(constants.TemplateVariableResourceGroupName, tl.getInput(constants.ResourceGroupInputName, true));
        this._templateVariables.set(constants.TemplateVariableStorageAccountName, tl.getInput(constants.StorageAccountInputName, true));
        this._templateVariables.set(constants.TemplateVariableImagePublisherName, tl.getInput(constants.ImagePublisherInputName, true));
        this._templateVariables.set(constants.TemplateVariableImageOfferName, tl.getInput(constants.ImageOfferInputName, true));
        this._templateVariables.set(constants.TemplateVariableImageSkuName, tl.getInput(constants.ImageSkuInputName, true));
        this._templateVariables.set(constants.TemplateVariableLocationName, tl.getInput(constants.LocationInputName, true));

        var capturePrefix = tl.getVariable('release.releaseName') || tl.getVariable('build.buildnumber') || "vstscapture";
        this._templateVariables.set(constants.TemplateVariableCapturePrefixName, capturePrefix);        
        
        // user deployment script specific variables
        var deployScriptPath = tl.getInput(constants.DeployScriptPathInputName, true);
        var packagePath = tl.getInput(constants.DeployPackageInputName, true);
        this._templateVariables.set(constants.TemplateVariableScriptPathName, deployScriptPath);
        this._templateVariables.set(constants.TemplateVariableScriptName, path.basename(deployScriptPath));
        this._templateVariables.set(constants.TemplateVariablePackagePathName, packagePath);
        this._templateVariables.set(constants.TemplateVariablePackageName, path.basename(packagePath));
        
        return this._templateVariables;
    }

    private _templateVariables: Map<string, string>;
}