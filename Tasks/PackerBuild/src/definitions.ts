import * as tr from "vsts-task-lib/toolrunner";

export enum TemplateFileProviderTypes {
    BuiltIn = 0,
    User = 1
}

export enum VariablesProviderTypes {
    AzureSPN = 0,
    TaskInput = 1
}

export interface IOutputParser {
    parse(line: string): void;
    getExtractedOutputs(): any;
}

export interface IPackerHost {
    createPackerTool(): tr.ToolRunner;
    execTool(command: tr.ToolRunner, outputParser?: IOutputParser): Q.Promise<any>;
    getTemplateFileProvider(): ITemplateFileProvider;
    getTemplateVariablesProviders(): ITemplateVariablesProvider[];
}

export interface ITemplateFileProvider {
    register(packerHost: IPackerHost): void;
    getTemplateFileLocation(): string;
    shouldTemplateFileBeCleanedup(): boolean;
}

export interface ITemplateVariablesProvider {
    register(packerHost: IPackerHost): void;
    getTemplateVariables(): Map<string, string>;
}