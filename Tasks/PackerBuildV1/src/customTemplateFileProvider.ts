"use strict";

import * as path from "path";
import * as util from "util";
import * as tl from "vsts-task-lib/task";
import * as constants from "./constants";
import * as definitions from "./definitions"
import * as utils from "./utilities"
import TemplateFileProviderBase from "./TemplateFileProviderBase"

export default class CustomTemplateFileProvider extends TemplateFileProviderBase implements definitions.ITemplateFileProvider {

    constructor() {
        super();
    }

    public register(packerHost: definitions.IPackerHost): void {
        packerHost.registerTemplateFileProvider(definitions.TemplateFileProviderTypes.Custom, this);
        tl.debug("registered custom template provider");
    }

    public getTemplateFileLocation(packerHost: definitions.IPackerHost): string {
        if(!!this._templateFileLocation) {
            return this._templateFileLocation;
        }

        var initialTemplateFileLocation = packerHost.getTaskParameters().customTemplateLocation;
        tl.checkPath(initialTemplateFileLocation, tl.loc("CustomTemplateNotFoundErrorMessagePathName", initialTemplateFileLocation));

        this._templateFileLocation = initialTemplateFileLocation;
        return this._templateFileLocation; 
    }
    
    public cleanup(): void {
        // do not delete in case of user provided template.
    }
}
