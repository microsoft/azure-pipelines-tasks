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

        // move file to a temp folder - this is a cautionary approach so that previous packer execution which still has handle on template does not cause any problem
        this.moveTemplateFile(initialTemplateFileLocation, packerHost.getStagingDirectory());
        return this._templateFileLocation; 
    }
}