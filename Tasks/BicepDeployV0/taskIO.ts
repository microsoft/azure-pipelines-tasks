import { InputParameterNames, InputReader, OutputSetter } from '@azure/bicep-deploy-common';
import tl = require('azure-pipelines-task-lib/task');

export class TaskInputReader implements InputReader {
    getInput(inputName: string): string | undefined {
        return tl.getInput(inputName, false);
    }
}

export class TaskOutputSetter implements OutputSetter {
    setOutput(name: string, value: any): void {
        tl.setVariable(name, value);
    }

    setFailed(message: string): void {
        tl.setResult(tl.TaskResult.Failed, message);
    }

    setSecret(secret: string): void {
        tl.setSecret(secret);
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