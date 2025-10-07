import * as tl from "azure-pipelines-task-lib/task";
import { TaskParameters } from "./taskParameter";
import { Secret } from "./models/secret";
import { Utils } from "./utils";
import {
    AppConfigurationClient,
    isSecretReference,
    ConfigurationSetting,
    parseSecretReference,
    GetSnapshotResponse,
    KnownSnapshotComposition
} from '@azure/app-configuration';
import { KeyVaultClient } from "./keyVaultClient";
import { RestError } from "@azure/core-rest-pipeline";
import { SnapshotStatus } from "./constants";
import { SelectionMode } from "./models/selectionMode";
import { ArgumentError, AppConfigurationError, getErrorMessage } from "./errors";

export class TaskController {

    private _taskparameters: TaskParameters;
    private _configurationClient: AppConfigurationClient;
    private _keyVaultClient: KeyVaultClient;
    private _taskResult: tl.TaskResult;

    constructor(taskParameters: TaskParameters) {
        this._taskparameters = taskParameters;

        this._configurationClient = new AppConfigurationClient(
            taskParameters.configStoreUrl,
            taskParameters.credential,
            {
                userAgentOptions: {
                    userAgentPrefix: Utils.GenerateUserAgent()
                }
            }
        );

        this._keyVaultClient = new KeyVaultClient(this._taskparameters.endpoint);

        this._taskResult = tl.TaskResult.Succeeded;
    }

    public async downloadKeyValue(): Promise<tl.TaskResult> {
        console.log(tl.loc("AzureAppConfigurationTaskIsStartingUp")); 
        console.log(tl.loc("AzureSubscriptionTitle"), this._taskparameters.endpoint.subscriptionName);
        console.log(tl.loc("AppConfigurationEndpointTitle"), this._taskparameters.configStoreUrl);
        console.log(tl.loc("SelectionModeTitle"), SelectionMode[this._taskparameters.selectionMode]);

        if (this._taskparameters.selectionMode == SelectionMode.Default) {
            console.log(tl.loc("KeyFilterTitle"),`'${this._taskparameters.keyFilter}'`);
            console.log(tl.loc("LabelFilterTitle"),this._taskparameters.label ? `"${this._taskparameters.label}"` : "(No label)");
        }

        if (this._taskparameters.selectionMode == SelectionMode.Snapshot) {
            console.log(tl.loc("SnapshotNameTitle"),`'${this._taskparameters.snapshotName}'`);
        }

        const configurationSettings: ConfigurationSetting<string>[] = await this._getConfigurationSettings();

        let duplicateKeyNumber: number = 0;

        for (const setting of configurationSettings) {

            // Check if variable is exists
            if (tl.getVariable(setting.key)) {
                duplicateKeyNumber++;
            }

            let isValidKey: boolean = false;
            let trimmedKey: string;

            if (setting.key) {
                trimmedKey = Utils.TrimKey(setting.key, this._taskparameters.prefixesToTrim);
                isValidKey = Utils.ValidateKey(trimmedKey);
            }

            if (isValidKey) {

                if (isSecretReference(setting)) {
                    const secret: Secret = await this._getKeyVaultSecret(setting);
                    if (secret) {
                        try {
                            Utils.SetVariable(trimmedKey, secret.value, true);
                        }
                        catch (error) {
                            this._handleKeyVaultError(error);
                        }
                    }
                }
                else {
                    Utils.SetVariable(trimmedKey, setting.value, false);
                }
            }
            else {
                tl.warning(tl.loc("InvalidVariableName", setting.key));
            }
        }

        console.log(tl.loc("RetrievedKeyValues",configurationSettings.length));

        if (duplicateKeyNumber > 0 && !this._taskparameters.suppressWarningForOverriddenKeys) {
            tl.warning(tl.loc("DuplicateKeysFound", duplicateKeyNumber));
        }

        return this._taskResult;
    }

    private async _getConfigurationSettings(): Promise<ConfigurationSetting<string>[]> {
        let settings: ConfigurationSetting<string>[] = [];
        try {
            if (this._taskparameters.selectionMode == SelectionMode.Default) {
                settings = await this._getSettingsViaKeyLabel();
            }
            else {
                settings = await this._getSettingsViaSnapshot();
            }
            return settings;
        }
        catch (e) {
            if (e instanceof RestError && e.statusCode == 403) {
                tl.debug(e.response?.bodyAsText);
                throw new AppConfigurationError(getErrorMessage(e, tl.loc("AccessDenied")));
            }
            throw e;
        }
    }

    private async _getSettingsViaKeyLabel(): Promise<ConfigurationSetting<string>[]> {
        const settings: ConfigurationSetting<string>[] = [];
        for await (const configuration of this._configurationClient.listConfigurationSettings({
            keyFilter: this._taskparameters.keyFilter,
            labelFilter: this._taskparameters.label || '\0'
        })) {
            settings.push(configuration);
        }
        return settings;
    }

    private async _getSettingsViaSnapshot(): Promise<ConfigurationSetting<string>[]> {
        const settings: ConfigurationSetting<string>[] = [];
        let snapshotDetails: GetSnapshotResponse;

        try {
            snapshotDetails = await this._configurationClient.getSnapshot(this._taskparameters.snapshotName);
        }
        catch (e) {
            if (e instanceof RestError && e.statusCode == 404) {
                tl.debug(e.response?.bodyAsText);
                
                throw new AppConfigurationError(getErrorMessage(e, tl.loc("SnapshotNotFound",this._taskparameters.snapshotName)));
            }
            throw e;
        }
       
        if (snapshotDetails.compositionType == KnownSnapshotComposition.KeyLabel) {
            throw new ArgumentError(tl.loc("InvalidCompositionTypeValue", KnownSnapshotComposition.KeyLabel, KnownSnapshotComposition.Key));
        }
       
        if (snapshotDetails.status == SnapshotStatus.Archived) {
            tl.warning(tl.loc("ArchivedSnapshotWarning", this._taskparameters.snapshotName, snapshotDetails.expiresOn));
        }

        for await (const configuration of this._configurationClient.listConfigurationSettingsForSnapshot(this._taskparameters.snapshotName)) {
            settings.push(configuration);
        }

        return settings;
    }

    private async _getKeyVaultSecret(setting: ConfigurationSetting): Promise<Secret> {
        try {
            const secret: Secret = await this._keyVaultClient.getSecret(parseSecretReference(setting));
            return secret;
        }
        catch (e) {
            tl.debug(JSON.stringify(e.message));

            let error: any = e;

            if (e instanceof RestError && e.statusCode == 403) {
                tl.debug(e.response?.bodyAsText);
                error = new AppConfigurationError(getErrorMessage(e,tl.loc("AccessDeniedToUrl",e.request.url)));
            }

            this._handleKeyVaultError(error);
        }
    }

    private _handleKeyVaultError(error: Error) {
        if (this._taskparameters.treatKeyVaultErrorsAsWarning) {
            tl.warning(error.message);
            // Partial success when encounter keyvault resolution errors
            this._taskResult = tl.TaskResult.SucceededWithIssues;
        } 
        else {
            throw error;
        }
    }
}