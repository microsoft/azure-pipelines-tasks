"use strict";

import * as path from "path";
import * as util from "util";
import * as tl from "vsts-task-lib/task";
import * as constants from "./constants";
import * as definitions from "./definitions"
import * as utils from "./utilities"
import TemplateFileProviderBase from "./TemplateFileProviderBase"

export default class BuiltInTemplateFileProvider extends TemplateFileProviderBase implements definitions.ITemplateFileProvider {

    constructor() {
        super();
        this._builtInTemplateFiles = new Map<string, string>();
        this._builtInTemplateFiles.set(constants.BuiltInTemplateOSTypeWindows, path.join(utils.getCurrentDirectory(), "..//DefaultTemplates", constants.BuiltInWindowsTemplateName));
        this._builtInTemplateFiles.set(constants.BuiltInTemplateOSTypeLinux, path.join(utils.getCurrentDirectory(), "..//DefaultTemplates", constants.BuiltInLinuxTemplateName));        
    }

    public register(packerHost: definitions.IPackerHost): void {
        packerHost.registerTemplateFileProvider(definitions.TemplateFileProviderTypes.BuiltIn, this);
        tl.debug("registered builtin template provider");
    }

    public getTemplateFileLocation(packerHost: definitions.IPackerHost): string {
        if(!!this._templateFileLocation) {
            return this._templateFileLocation;
        }

        var osType = packerHost.getTaskParameters().osType;
        if(this._builtInTemplateFiles.has(osType)) {
            var initialTemplateFileLocation = this._builtInTemplateFiles.get(osType);
            tl.checkPath(initialTemplateFileLocation, tl.loc("BuiltInTemplateNotFoundErrorMessagePathName", osType));
            this.FinalizeTemplateLocation(initialTemplateFileLocation);
            return this._templateFileLocation; 
        }

        throw (tl.loc("OSTypeNotSupported", osType));
    }

    private _builtInTemplateFiles: Map<string, string>;
}