import * as tl from 'azure-pipelines-task-lib/task';
import { TaskParameters } from "./taskParameters";
import { 
    AppConfigurationImporter, 
    ConfigurationFormat, 
    ConfigurationProfile,
    ImportResult,
    ImportMode, 
    ArgumentError } from "@azure/app-configuration-importer";
import { FileConfigurationSettingsSource, FileConfigurationSyncOptions } from "@azure/app-configuration-importer-file-source";
import { AppConfigurationClient } from '@azure/app-configuration';
import { Utils } from "./utils";
import { FileContentProfileConstants, FileFormat} from "./constants";
import { RestError } from "@azure/core-rest-pipeline";
import { AppConfigurationError, getErrorMessage } from "./errors";

export class TaskController {
    private static readonly maxTimeout = 2147483; //When delay is larger than 2147483647 or less than 1, the delay will be set to 1 https://nodejs.org/api/timers.html#settimeoutcallback-delay-args

    private _taskParameters: TaskParameters;
    private _client: AppConfigurationClient;

    constructor(taskParameters: TaskParameters) {

        this._taskParameters = taskParameters;

        this._client = new AppConfigurationClient(
            taskParameters.configStoreUrl,
            taskParameters.credential,
            {
                userAgentOptions: {
                    userAgentPrefix: Utils.GenerateUserAgent()
                }
            }
        );
    }

    public async sync(): Promise<void> {
        
        const format: string = this._taskParameters.useFilePathExtension ? this._taskParameters.filePath.split('.').pop().toLowerCase() : this._taskParameters.fileFormat;

        console.log(tl.loc("AzureAppConfigurationPushTaskStartingUp"));
        console.log(tl.loc("AzureSubscriptionTitle"), this._taskParameters.endpoint.subscriptionName);
        console.log(tl.loc("AppConfigurationEndpointTitle"), this._taskParameters.configStoreUrl);
        console.log(tl.loc("StrictTitle"), this._taskParameters.strict);
        console.log(tl.loc("FileFormatTitle"), format);
        console.log(tl.loc("FileContentProfileTitle"), this._taskParameters.profile);
        console.log(tl.loc("DryRunTitle"), this._taskParameters.dryRun);
        console.log(tl.loc("ImportModeTitle"), ImportMode[this._taskParameters.importMode]);

        if (this._taskParameters.profile == FileContentProfileConstants.Default) {

            console.log(tl.loc("SeparatorTitle"), this._taskParameters.separator ? `"${this._taskParameters.separator}"` : "None");
            console.log(tl.loc("LabelTitle"), this._taskParameters.label ? `"${this._taskParameters.label}"` : "(No label)");
        }

        const appConfigurationImporterClient: AppConfigurationImporter = new AppConfigurationImporter(this._client);
        let successCount: number = 0;

        let fileFormat: ConfigurationFormat;

        switch (format) {
            case FileFormat.Json:
                fileFormat = ConfigurationFormat.Json;
                break;
            case FileFormat.Yaml:
            case FileFormat.Yml:
                fileFormat = ConfigurationFormat.Yaml;
                break;
            case FileFormat.Properties:
                fileFormat = ConfigurationFormat.Properties;
                break;
            default:
                throw new ArgumentError(tl.loc("FileFormatNotSupported", format, FileFormat.Json, FileFormat.Yaml, FileFormat.Properties));
        }

        const fileConfigOptions: FileConfigurationSyncOptions = {
            filePath: this._taskParameters.filePath,
            format: fileFormat,
            separator: this._taskParameters.separator,
            depth: this._taskParameters.depth,
            profile: this._taskParameters.profile == FileContentProfileConstants.KVSet ?
                ConfigurationProfile.KvSet: ConfigurationProfile.Default,
            contentType: this._taskParameters.contentType,
            label: this._taskParameters.label,
            prefix: this._taskParameters.prefix,
            skipFeatureFlags: this._taskParameters.excludeFeatureFlags,
            tags: this._taskParameters.tags
        };

        // eslint-disable-next-line @typescript-eslint/typedef
        const progressCallBack = (progressResults: ImportResult) => {
            successCount = progressResults.successCount;
        };

        try {
            await appConfigurationImporterClient.Import(
                new FileConfigurationSettingsSource(fileConfigOptions),
                TaskController.maxTimeout, //setting timeout to max value possible, align with ADO https://learn.microsoft.com/en-us/azure/devops/pipelines/process/phases?view=azure-devops&tabs=classic#timeouts
                this._taskParameters.strict,
                progressCallBack,
                this._taskParameters.importMode,
                this._taskParameters.dryRun);
        }
        catch (error) {
            if (error instanceof RestError) {

                if (error.statusCode == 403) {

                    tl.debug(error.response?.bodyAsText);
                    throw new AppConfigurationError(getErrorMessage(error, tl.loc("AccessDeniedMessage")));
                }

                if (error.statusCode == 409) {
                    const targetSetting: string = JSON.parse(error.message).name;

                    tl.debug(error.response?.bodyAsText);
                    throw new AppConfigurationError(getErrorMessage(error, tl.loc("ConflictErrorMessage", targetSetting)));
                }
            }
            throw error;
        }
        
        console.log(tl.loc("SuccessfullyUploadedConfigurations", successCount));
    }
}