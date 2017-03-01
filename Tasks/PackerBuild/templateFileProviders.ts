"use strict";

import * as path from "path";
import * as tl from "vsts-task-lib/task";
import * as ptm from "./packerTemplateManager";
import packerHost from "./packerHost";
import * as constants from "./constants"

export class BuiltInTemplateFileProvider implements ptm.ITemplateFileProvider {

    constructor() {
        this._builtInTemplateFiles = new Map<string, string>();
        this._builtInTemplateFiles.set(constants.BuiltInTemplateOSTypeWindows, constants.BuiltInWindowsTemplateLocation);
    }

    public register(packerHost: packerHost): void {
        packerHost.templateManager.registerTemplateFileProvider(ptm.TemplateFileProviderTypes.BuiltIn, this);
        tl.debug("registered builtin template provider");
    }

    public getTemplateFileLocation(osType: string): string {
        if(this._builtInTemplateFiles.has(osType)) {
            return this._builtInTemplateFiles.get(osType);
        }

        throw (tl.loc("OSTypeNotSupported", osType));
    }

    private _builtInTemplateFiles: Map<string, string>;
}