import * as tl from "azure-pipelines-task-lib/task";
import { Color, colorize, Logger, LoggingMessageConfig, ErrorMessageConfig } from "@azure/bicep-deploy-common";

const logWarningRaw = (message: string) => tl.warning(message);
const logErrorRaw = (message: string) => tl.error(message);

export class TaskLogger implements Logger {
    isDebugEnabled = () => (process.env["SYSTEM_DEBUG"] || "").toLowerCase() === "true";
    debug = (message: string) => tl.debug(message);
    logInfoRaw = (message: string) => console.log(message);
    logInfo = (message: string) => this.logInfoRaw(colorize(message, Color.Blue));
    logWarning = (message: string) => logWarningRaw(colorize(message, Color.Yellow));
    logError = (message: string) => logErrorRaw(colorize(message, Color.Red));
}

export const loggingMessageConfig: LoggingMessageConfig = {
    diagnosticsReturned: tl.loc('DiagnosticsReturned'),
    bicepVersionInstalled: (version: string, path: string) => 
        tl.loc('BicepVersionInstalled', version, path),
    requestFailedCorrelation: (correlationId: string | null) => 
        tl.loc('RequestFailedCorrelation', correlationId),
    filesIgnoredForDelete: tl.loc('FilesIgnoredForDelete'),
    startingOperation: (type: string, operation: string, scope: string, scopedId: string, name: string) =>
        tl.loc('StartingOperation', type, operation, scope, scopedId, name ? ` with name '${name}'` : ''),
    usingTemplateFile: (templateFile: string) =>
        tl.loc('UsingTemplateFile', templateFile),
    usingParametersFile: (parametersFile: string) =>
        tl.loc('UsingParametersFile', parametersFile),
};

export const errorMessageConfig: ErrorMessageConfig = {
    // Handler errors
    createFailed: tl.loc('CreateFailed'),
    validationFailed: tl.loc('ValidationFailed'),
    operationFailed: tl.loc('OperationFailed'),
    requestFailedCorrelation: (correlationId: string) => 
        tl.loc('RequestFailedCorrelation', correlationId),
    
    // Input errors
    inputMustBeBoolean: (inputName: string) => 
        tl.loc('InputMustBeBoolean', inputName),
    inputRequired: (inputName: string) => 
        tl.loc('InputRequired', inputName),
    inputMustBeEnum: (inputName: string, allowedValues: string[]) => 
        tl.loc('InputMustBeEnum', inputName, allowedValues.join(`', '`)),
    inputMustBeValidObject: (inputName: string) => 
        tl.loc('InputMustBeValidObject', inputName),
    inputMustBeStringObject: (inputName: string) => 
        tl.loc('InputMustBeStringObject', inputName),
    
    // Utils errors
    locationRequired: tl.loc('LocationRequired'),
    failedToDetermineScope: tl.loc('FailedToDetermineScope'),
    
    // File errors
    unsupportedParametersFile: (parametersFile: string) => 
        tl.loc('UnsupportedParametersFile', parametersFile),
    unsupportedTemplateFile: (templateFile: string) => 
        tl.loc('UnsupportedTemplateFile', templateFile),
    templateFileRequired: tl.loc('TemplateFileRequired'),
    
    // WhatIf errors
    invalidChangeType: (changeType: string) => 
        tl.loc('InvalidChangeType', changeType),
    unknownPropertyChangeType: (propertyChangeType: string) => 
        tl.loc('UnknownPropertyChangeType', propertyChangeType),
    invalidJsonValue: (value: unknown) => 
        tl.loc('InvalidJsonValue', value),
};