"use strict";

import * as tl from "vsts-task-lib/task";
import * as tr from "vsts-task-lib/toolrunner";
import * as utils from "./utilities";
import * as constants from "./constants";
import * as definitions from "./definitions"
import TaskParameters from "./taskParameters"


export default class PackerHost implements definitions.IPackerHost {

    constructor() {
        this._packerPath = tl.which("packer", true);
        this._templateFileProviders = {};
        this._templateVariablesProviders = {};
        this._taskParameters = new TaskParameters();
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

    public getTaskParameters(): TaskParameters {
        return this._taskParameters;
    }

    public getTemplateFileProvider(): definitions.ITemplateFileProvider {
        if(this._taskParameters.templateType === "custom") {
            return this._templateFileProviders[definitions.TemplateFileProviderTypes.Custom];
        } else {
            return this._templateFileProviders[definitions.TemplateFileProviderTypes.BuiltIn];
        }
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
    private _taskParameters: TaskParameters;
    private _templateFileProviders: ObjectDictionary<definitions.ITemplateFileProvider>;
    private _templateVariablesProviders: ObjectDictionary<definitions.ITemplateVariablesProvider>;
}

interface ObjectDictionary<T> { [key: number]: T; }