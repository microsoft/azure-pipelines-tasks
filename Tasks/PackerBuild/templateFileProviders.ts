"use strict";

import * as path from "path";
import * as tl from "vsts-task-lib/task";
import * as ptm from "./packerTemplateManager";
import packerHost from "./packerHost";

export class BuiltInTemplateFileProvider implements ptm.ITemplateFileProvider {

    constructor() {
        this._builtInTemplateFiles = new Map<string, string>();
        this._builtInTemplateFiles.set("windows", ".\\DefaultTemplates\\default.windows.template.json");
    }

    public register(packerHost: packerHost): void {
        packerHost.templateManager.registerTemplateFileProvider(ptm.TemplateFileProviderTypes.BuiltIn, this);
    }

    public getTemplateFileLocation(osType: string): string {
        if(this._builtInTemplateFiles.has(osType)) {
            return this._builtInTemplateFiles.get(osType);
        }

        throw (tl.loc("DefaultTemplateNotFound", osType));
    }

    private _builtInTemplateFiles: Map<string, string>;
}