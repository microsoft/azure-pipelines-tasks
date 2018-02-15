import * as tr from "vsts-task-lib/toolrunner";
import TaskParameters from "./taskParameters"

export enum TemplateFileProviderTypes {
    BuiltIn = 0,
    Custom = 1
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
    registerTemplateFileProvider(providerType: TemplateFileProviderTypes, provider: ITemplateFileProvider);
    registerTemplateVariablesProvider(providerType: VariablesProviderTypes, provider: ITemplateVariablesProvider);
    getTaskParameters(): TaskParameters;
    getStagingDirectory(): string;
}

export interface ITemplateFileProvider {
    register(packerHost: IPackerHost): void;
    getTemplateFileLocation(packerHost: IPackerHost): string;
    saveUpdatedTemplateFile(content: string, newNameSuffix: string): void;
    cleanup(): void;
}

export interface ITemplateVariablesProvider {
    register(packerHost: IPackerHost): void;
    getTemplateVariables(packerHost: IPackerHost): Promise<Map<string, string>>;
}