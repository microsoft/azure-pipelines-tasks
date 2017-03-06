"use strict";

import * as path from "path";
import * as tl from "vsts-task-lib/task";
//import PackerTemplateManager from "./packerTemplateManager";
import packerHost from "./packerHost";
import * as constants from "./constants";
import * as definitions from "./definitions"
import * as utils from "./utilities"

export default class BuiltInTemplateFileProvider implements definitions.ITemplateFileProvider {

    constructor() {
        this._builtInTemplateFiles = new Map<string, string>();
        this._builtInTemplateFiles.set(constants.BuiltInTemplateOSTypeWindows, constants.BuiltInWindowsTemplateLocation);
    }

    public register(packerHost: packerHost): void {
        packerHost.registerTemplateFileProvider(definitions.TemplateFileProviderTypes.BuiltIn, this);
        tl.debug("registered builtin template provider");
    }

    public getTemplateFileLocation(): string {
        if(!!this._templateFileLocation) {
            return this._templateFileLocation;
        }

        var osType = tl.getInput(constants.OsTypeInputName);
        if(this._builtInTemplateFiles.has(osType)) {
            var templateFileLocation = this._builtInTemplateFiles.get(osType);
            tl.checkPath(templateFileLocation, tl.loc("BuiltInTemplateNotFoundErrorMessagePathName", osType));
            console.log(tl.loc("OriginalTemplateLocation", templateFileLocation));

            // move file to a temp folder - this is a cautionary approach so that previous packer execution which still has handle on template does not cause any problem
            var tempLocationForTemplate = path.join(utils.getTempDirectory(), utils.getCurrentTime().toString())
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

        throw (tl.loc("OSTypeNotSupported", osType));
    }

    private _builtInTemplateFiles: Map<string, string>;
    private _templateFileLocation: string;
}