import * as tl from "azure-pipelines-task-lib/task";
import { AzureEndpoint } from "azure-pipelines-tasks-azure-arm-rest/azureModels";
import { AzureRMEndpoint } from "azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint";
import { SelectionMode } from "./models/selectionMode";
import { ConnectedServiceCredential } from "./connectedServiceCredentials";
import { ArgumentError } from "./errors";

export class TaskParameters {

    private static readonly NewlineRegex = /\r?\n/;

    public credential: ConnectedServiceCredential;
    public configStoreUrl: string;
    public selectionMode: SelectionMode;
    public keyFilter: string;
    public label: string;
    public snapshotName: string;
    public prefixesToTrim: string[];
    public endpoint: AzureEndpoint;
    public suppressWarningForOverriddenKeys: boolean;
    public treatKeyVaultErrorsAsWarning: boolean;

    public static async initializeTaskParameters(): Promise<TaskParameters> {
        const Default: string = "Default";
        const Snapshot: string = "Snapshot";

        const taskParameters: TaskParameters = new TaskParameters();

        const selectionMode: string = tl.getInput("SelectionMode", false);

        if (selectionMode != Default &&
            selectionMode != Snapshot) {
            throw new ArgumentError(tl.loc("SupportedOptionsForSelectionMode", Default, Snapshot));
        }

        taskParameters.selectionMode = selectionMode == Default ? SelectionMode.Default : SelectionMode.Snapshot;
        try {
            taskParameters.configStoreUrl = tl.getInput("AppConfigurationEndpoint", true);
            taskParameters.keyFilter = tl.getInput("KeyFilter", taskParameters.selectionMode == SelectionMode.Default);
            taskParameters.snapshotName = tl.getInput("SnapshotName", taskParameters.selectionMode == SelectionMode.Snapshot);
        }
        catch (e) {

            throw new ArgumentError(`${e.message}`);
        }

        taskParameters.label = tl.getInput("Label", false);
        taskParameters.suppressWarningForOverriddenKeys = tl.getBoolInput("SuppressWarningForOverriddenKeys", false);
        taskParameters.treatKeyVaultErrorsAsWarning = tl.getBoolInput("TreatKeyVaultErrorsAsWarning", false);

        const trimKeyPrefixInput: string = tl.getInput("TrimKeyPrefix", false);

        if (trimKeyPrefixInput) {

            taskParameters.prefixesToTrim = trimKeyPrefixInput.split(TaskParameters.NewlineRegex);
        }
        else {

            taskParameters.prefixesToTrim = [];
        }

        const connectedService: string = tl.getInput("ConnectedServiceName", true);
        const endpoint: AzureEndpoint = await new AzureRMEndpoint(connectedService).getEndpoint();

        //
        // Verify that a config store endpoint was provided, a user could input store name instead of configstore endpoint.
        if (!taskParameters.configStoreUrl.startsWith('https://')) {

            throw new ArgumentError(tl.loc("InvalidAppConfigurationEndpoint",taskParameters.configStoreUrl));
        }

        taskParameters.endpoint = endpoint;

        taskParameters.credential = new ConnectedServiceCredential(taskParameters.endpoint, taskParameters.configStoreUrl);

        return taskParameters;
    }
}