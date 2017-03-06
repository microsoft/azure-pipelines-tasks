"use strict";

import * as tl from "vsts-task-lib/task";
import * as tr from "vsts-task-lib/toolrunner";
//import PackerTemplateManager from "./packerTemplateManager";
import * as utils from "./utilities";
import * as constants from "./constants";
import * as definitions from "./definitions"

export default class PackerHost implements definitions.IPackerHost {

    constructor() {
        this._packerPath = tl.which("packer", true);
        this._templateFileProviders = {};
        this._templateVariablesProviders = {};
    }

    // Will create and return packer toolrunner
    public createPackerTool(): tr.ToolRunner {
        var command = tl.tool(this._packerPath);
        return command;
    }

    // Creates packer toolrunner with options
    // Also sets up parser which will parse output log on the fly
    public execTool(command: tr.ToolRunner, outputParser?: definitions.IOutputParser): Q.Promise<any> {
        var outputExtractorFunc = null;
        if(!!outputParser) {
            outputExtractorFunc = (line: string) => {
                outputParser.parse(line);
            }
        }

        var options = <any>{
            outStream: new utils.StringWritable({ decodeStrings: false }, outputExtractorFunc),
            errStream: new utils.StringWritable({ decodeStrings: false })
        };

        return command.exec(options);
    }

    public getTemplateFileProvider(): definitions.ITemplateFileProvider {
        var templateFileProvider = this._templateFileProviders[definitions.TemplateFileProviderTypes.BuiltIn];
        return templateFileProvider;
    }

    public getTemplateVariablesProviders(): definitions.ITemplateVariablesProvider[] {
        var taskInputTemplateVariablesProvider = this._templateVariablesProviders[definitions.VariablesProviderTypes.TaskInput];
        var azureSpnTemplateVariablesProvider = this._templateVariablesProviders[definitions.VariablesProviderTypes.AzureSPN];
        
        return [taskInputTemplateVariablesProvider, azureSpnTemplateVariablesProvider];
    }

    public registerTemplateFileProvider(providerType: definitions.TemplateFileProviderTypes, provider: definitions.ITemplateFileProvider) {
        this._templateFileProviders[providerType] = provider;
    }

    public registerTemplateVariablesProvider(providerType: definitions.VariablesProviderTypes, provider: definitions.ITemplateVariablesProvider) {
        this._templateVariablesProviders[providerType] = provider;
    }

    private _packerPath: string;
    private _templateFileProviders: ObjectDictionary<definitions.ITemplateFileProvider>;
    private _templateVariablesProviders: ObjectDictionary<definitions.ITemplateVariablesProvider>;
}

interface ObjectDictionary<T> { [key: number]: T; }