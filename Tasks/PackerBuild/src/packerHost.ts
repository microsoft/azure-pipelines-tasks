"use strict";

import * as tl from "vsts-task-lib/task";
import * as tr from "vsts-task-lib/toolrunner";
import * as ptm from "./packerTemplateManager";
import * as utils from "./utilities"
import * as op from "./outputParsers"

export default class PackerHost {
    public templateManager: ptm.PackerTemplateManager;

    constructor() {
        this._packerPath = tl.which("packer", true);
        this.templateManager = new ptm.PackerTemplateManager();
        this._extractedOutputs = new Map<string, string>();
    }

    // Will create and return toolrunner
    public createCommand(): tr.ToolRunner {
        var command = tl.tool(this._packerPath);
        return command;
    }

    // Creates toolrunner with options
    // Also sets up parser which will parse output log on the fly
    public execCommand(command: tr.ToolRunner, options?: tr.IExecOptions, outputParser?: op.IOutputParser): Q.Promise<any> {
        this._extractedOutputs.clear();

        var outputExtractorFunc = null;
        if(!!outputParser) {
            outputExtractorFunc = (line: string) => {
                outputParser.parse(line, this._extractedOutputs);
            }
        }

        if (!options) {
            options = <any>{
                outStream: new utils.StringWritable({ decodeStrings: false }, outputExtractorFunc),
                errStream: new utils.StringWritable({ decodeStrings: false })
            };
        }

        return command.exec(options);
    }

    public getExtractedOutputs(): any {
        return this._extractedOutputs;
    }

    private _packerPath: string;
    private _extractedOutputs: Map<string, string>;
}