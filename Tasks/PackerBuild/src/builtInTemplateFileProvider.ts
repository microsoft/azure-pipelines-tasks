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
        this._builtInTemplateFiles.set(constants.BuiltinWindowsDefaultImageTemplateKey, path.join(utils.getCurrentDirectory(), "..//DefaultTemplates", constants.BuiltInWindowsDefaultImageTemplateName));
        this._builtInTemplateFiles.set(constants.BuiltinWindowsCustomImageTemplateKey, path.join(utils.getCurrentDirectory(), "..//DefaultTemplates", constants.BuiltInWindowsCustomImageTemplateName));
        this._builtInTemplateFiles.set(constants.BuiltinLinuxDefaultImageTemplateKey, path.join(utils.getCurrentDirectory(), "..//DefaultTemplates", constants.BuiltInLinuxDefaultImageTemplateName));        
        this._builtInTemplateFiles.set(constants.BuiltinLinuxCustomImageTemplateKey, path.join(utils.getCurrentDirectory(), "..//DefaultTemplates", constants.BuiltInLinuxCustomImageTemplateName));        
    }

    public register(packerHost: definitions.IPackerHost): void {
        packerHost.registerTemplateFileProvider(definitions.TemplateFileProviderTypes.BuiltIn, this);
        tl.debug("registered builtin template provider");
    }

    public getTemplateFileLocation(packerHost: definitions.IPackerHost): string {
        if(!!this._templateFileLocation) {
            return this._templateFileLocation;
        }

        var taskParameters = packerHost.getTaskParameters();
        var osType = taskParameters.osType;
        var imageType = taskParameters.baseImageSource;
        var templateKey = util.format("%s-%s", osType, imageType);
        if(this._builtInTemplateFiles.has(templateKey)) {
            var initialTemplateFileLocation = this._builtInTemplateFiles.get(templateKey);
            tl.checkPath(initialTemplateFileLocation, tl.loc("BuiltInTemplateNotFoundErrorMessagePathName", templateKey));

            // move file to a temp folder - this is a cautionary approach so that previous packer execution which still has handle on template does not cause any problem
            this.moveTemplateFile(initialTemplateFileLocation, packerHost.getStagingDirectory());

            this.updateTemplateBuilderSection(taskParameters.additionalBuilderParameters);
            
            return this._templateFileLocation; 
        }

        throw (tl.loc("OSTypeNotSupported", osType));
    }

    private _builtInTemplateFiles: Map<string, string>;
}
