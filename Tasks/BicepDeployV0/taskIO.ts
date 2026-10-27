import { InputParameterNames, InputReader, OutputOptions, OutputSetter } from '@azure/bicep-deploy-common';
import tl = require('azure-pipelines-task-lib/task');

export class TaskInputReader implements InputReader {
    getInput(inputName: string): string | undefined {
        return tl.getInput(inputName, false);
    }

    isFilePathSupplied(inputName: string): boolean {
        return tl.filePathSupplied(inputName);
    }
}

// Writes a step output variable without tl.setVariable, which would also set process.env.
// Secret values are registered with tl.setSecret first, so the value is masked before the agent processes the variable command.
export function publishOutputVariable(name: string, value: string, isSecret: boolean): void {
    if (isSecret) {
        tl.setSecret(value);
    }
    tl.command('task.setvariable', {
        variable: name,
        isOutput: 'true',
        issecret: isSecret ? 'true' : 'false',
    }, value);
}

export class TaskOutputSetter implements OutputSetter {
    setOutputVariable(name: string, value: unknown, options: OutputOptions): void {
        // isOutput=true makes this variable available as $(stepName.outputName) in later steps.
        const stringValue = value === undefined || value === null ? ''
            : typeof value === 'object' ? JSON.stringify(value)
            : String(value);
        publishOutputVariable(name, stringValue, options.isSecret);
    }

    setFailed(message: string): void {
        tl.setResult(tl.TaskResult.Failed, message);
    }
}

export class TaskInputParameterNames implements InputParameterNames {
    type = 'type';
    name = 'name';
    location = 'location';
    templateFile = 'templateFile';
    parametersFile = 'parametersFile';
    parameters = 'parameters';
    bicepVersion = 'bicepVersion';
    description = 'description';
    tags = 'tags';
    maskedOutputs = 'maskedOutputs';
    environment = 'environment';
    operation = 'operation';
    whatIfExcludeChangeTypes = 'whatIfExcludeChangeTypes';
    validationLevel = 'validationLevel';
    actionOnUnmanageResources = 'actionOnUnmanageResources';
    actionOnUnmanageResourceGroups = 'actionOnUnmanageResourceGroups';
    actionOnUnmanageManagementGroups = 'actionOnUnmanageManagementGroups';
    bypassStackOutOfSyncError = 'bypassStackOutOfSyncError';
    denySettingsMode = 'denySettingsMode';
    denySettingsExcludedActions = 'denySettingsExcludedActions';
    denySettingsExcludedPrincipals = 'denySettingsExcludedPrincipals';
    denySettingsApplyToChildScopes = 'denySettingsApplyToChildScopes';
    scope = 'scope';
    tenantId = 'tenantId';
    managementGroupId = 'managementGroupId';
    subscriptionId = 'subscriptionId';
    resourceGroupName = 'resourceGroupName';
}