"use strict";

import * as tl from "vsts-task-lib/task";
import * as tr from "vsts-task-lib/toolrunner";
import * as ptm from "./packerTemplateManager";
import * as utils from "./utilities"
import * as op from "./outputParsers"

export default class PackerHost {
    public templateManager: ptm.PackerTemplateManager;

    // will detect/install packer exe location and validate that it can run, version etc
    constructor() {
        this._packerPath = tl.which("packer", true);
        this.templateManager = new ptm.PackerTemplateManager();
        //this._outStream = new utils.StringWritable({ decodeStrings: false });
        //this._errStream = new utils.StringWritable({ decodeStrings: false });
        this._extractedOutputs = new Map<string, string>();
    }

    // will create and return toolrunner
    public createCommand(): tr.ToolRunner {
        var command = tl.tool(this._packerPath);
        return command;
    }

    // will invoke toolrunner with options
    // this will also set a timeout on the toolrunner promise. if tool does not return in fixed time
    public execCommand(command: tr.ToolRunner, options?: tr.IExecOptions, outputParser?: op.IOutputParser): Q.Promise<any> {
        //this._outStream.clear();
        //this._errStream.clear();
        this._extractedOutputs.clear();

        // var errlines: string[] = [];
        // command.on("errline", line => {
        //     errlines.push(line);
        // });

        var outputExtractorFunc = null;
        if(!!outputParser) {
            outputExtractorFunc = (line: string) => {
                outputParser.parse(line, this._extractedOutputs);
            }
        }

        // if(!!outputExtractionKeys && outputExtractionKeys.length > 0) {
        //     command.on("stdline", (line: string) => {
        //         outputExtractionKeys.forEach((key: string) => {
        //             if(line.startsWith(key)) {
        //                 this._extractedOutputs[key] = line;
        //                 return;
        //             }
        //         })
        //     });
        // }

        if (!options) {
            options = <any>{
                outStream: new utils.StringWritable({ decodeStrings: false }, outputExtractorFunc),
                errStream: new utils.StringWritable({ decodeStrings: false })
            };
        }

        return command.exec(options)
        // .then((code: number) => {
        //     //console.log(options.outStream.toString());
        // },
        //     error => {
        //         errlines.forEach(line => tl.error(line));
        //         throw error;
        //     });
    }

    // public getLastCommandOutputLog(): string {
    //     return this._outStream.toString();
    // }

    public getExtractedOutputs(): any {
        return this._extractedOutputs;
    }

    //Dispose() // will delete packer.exe if it was created in initialize(). Will forcefully kill packer process if required

    private _packerPath: string;
    //private _outStream: utils.StringWritable;
    //private _errStream: utils.StringWritable;
    private _extractedOutputs: Map<string, string>;
}