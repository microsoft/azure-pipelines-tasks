import * as tl from 'azure-pipelines-task-lib/task';
import { IExecSyncResult } from 'azure-pipelines-task-lib/toolrunner';

export class Utility {
    /**
     * Re-uses the throwIfError code implemented by the AzureCLIV2 Azure DevOps Task.
     * https://github.com/microsoft/azure-pipelines-tasks/blob/b82a8e69eb862d1a9d291af70da2e62ee69270df/Tasks/AzureCLIV2/src/Utility.ts#L79-L87
     * @param resultOfToolExecution - the result of the command that was previously executed
     * @param errormsg - the error message to display if the command failed
     */
     public throwIfError(resultOfToolExecution: IExecSyncResult, errormsg?: string): void {
        if (resultOfToolExecution.code !== 0) {
            tl.error(tl.loc('ErrorCodeFormat', resultOfToolExecution.code));
            if (errormsg) {
                tl.error(tl.loc('ErrorMessageFormat', errormsg));
            }
            throw resultOfToolExecution;
        }
    }

    /**
     * Sets the Azure CLI to dynamically install extensions that are missing. In this case, we care about the
     * Azure Container Apps module being dynamically installed while it's still in preview.
     */
    public setAzureCliDynamicInstall() {
        this.throwIfError(
            tl.execSync('az', 'config set extension.use_dynamic_install=yes_without_prompt'),
            'Unable to set the Azure CLI to dynamically install missing extensions');
    }

    /**
     * Checks whether or not the provided string is null, undefined or empty.
     * @param str - the string to validate
     * @returns true if the string is null, undefined or empty, false otherwise
     */
    public isNullOrEmpty(str: string): boolean {
        return str === null || str === undefined || str === "";
    }
}