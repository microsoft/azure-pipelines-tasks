"use strict";

import * as os from "os";
import * as path from "path";
import * as tl from "vsts-task-lib/task";
import * as utils from "./utilities"
import packerHost from "./packerHost";
import * as constants from "./constants"

export class PackerTemplateManager {

    constructor() {
        this._templateFileProviders = {};
        this._templateVariablesProviders = {};
    }

    public registerTemplateFileProvider(providerType: TemplateFileProviderTypes, provider: ITemplateFileProvider) {
        this._templateFileProviders[providerType] = provider;
    }

    public registerTemplateVariablesProvider(providerType: VariablesProviderTypes, provider: ITemplateVariablesProvider) {
        this._templateVariablesProviders[providerType] = provider;
    }

    public getTemplateFileLocation(): string {
        if(!!this._templateFileLocation) {
            return this._templateFileLocation;
        }

        // get template file location from suitable provider
        var osType = tl.getInput(constants.OsTypeInputName);
        var templateProvider = this._templateFileProviders[TemplateFileProviderTypes.BuiltIn];
        var templateFileLocation = templateProvider.getTemplateFileLocation(osType);
        console.log(tl.loc("OriginalTemplateLocation", templateFileLocation));

        // move file to a temp folder
        var tempLocationForTemplate = path.join(os.tmpdir(), new Date().getTime().toString());
        console.log(tl.loc("CopyingTemplate", templateFileLocation, tempLocationForTemplate));
        utils.copyFile(templateFileLocation, tempLocationForTemplate);
        console.log(tl.loc("TempTemplateLocation", tempLocationForTemplate));      
        
        // construct new full path for template file
        var templateFileName = path.basename(templateFileLocation);
        var tempFileLocation = path.join(tempLocationForTemplate, templateFileName);
        this._templateFileLocation = tempFileLocation;
        tl.debug("template location: " + tempFileLocation);

        return tempFileLocation; 
    }

    public getTemplateVariables(): Map<string, string> {
        if(!!this._templateVariables) {
            return this._templateVariables;
        }

        var osType = tl.getInput(constants.OsTypeInputName);
        this._templateVariables = new Map<string, string>();
        
        var inputVariablesProvider = this._templateVariablesProviders[VariablesProviderTypes.TaskInput];
        var inputVariables = inputVariablesProvider.getTemplateVariables(osType);
        inputVariables.forEach((value: string, key: string) => this._templateVariables.set(key, value));

        var azureSPNVariablesProvider = this._templateVariablesProviders[VariablesProviderTypes.AzureSPN];
        var spnVariables = azureSPNVariablesProvider.getTemplateVariables(osType);
        spnVariables.forEach((value: string, key: string) => this._templateVariables.set(key, value));
        
        return this._templateVariables;
    }

    private _templateFileProviders: ObjectDictionary<ITemplateFileProvider>;
    private _templateFileLocation: string;
    private _templateVariablesProviders: ObjectDictionary<ITemplateVariablesProvider>;
    private _templateVariables: Map<string, string>;
}

export enum TemplateFileProviderTypes {
    BuiltIn = 0,
    User = 1
}

export enum VariablesProviderTypes {
    AzureSPN = 0,
    TaskInput = 1
}

export interface ITemplateFileProvider {
    register(packerHost: packerHost): void 
    getTemplateFileLocation(osType: string): string;
}

export interface ITemplateVariablesProvider {
    register(packerHost: packerHost): void 
    getTemplateVariables(osType: string): Map<string, string>;
}

interface ObjectDictionary<T> { [key: number]: T; }