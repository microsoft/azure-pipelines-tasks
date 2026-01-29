import * as tl from "azure-pipelines-task-lib/task";
import { AzureEndpoint } from "azure-pipelines-tasks-azure-arm-rest/azureModels"
import { AzureRMEndpoint } from "azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint";
import { Tags } from "./tags";
import { ImportMode, ArgumentError, ParseError } from "@azure/app-configuration-importer";
import { isString, isObject } from "lodash";
import { FileContentProfileConstants } from "./constants";
import { ConnectedServiceCredential } from "./connectedServiceCredential";

export class TaskParameters {

    public configStoreUrl: string;
    public profile: string;
    public separator: string;
    public depth: number;
    public strict: boolean;
    public prefix: string;
    public label: string;
    public tags: Tags;
    public contentType: string;
    public filePath: string;
    public fileFormat: string;
    public useFilePathExtension: boolean;
    public dryRun: boolean;
    public excludeFeatureFlags: boolean;
    public importMode: ImportMode;
    public credential: ConnectedServiceCredential;
    public endpoint: AzureEndpoint;
    public enableRiskAnalysis: boolean;

    public static async initialize(): Promise<TaskParameters> {
        const IgnoreMatch: string = "Ignore-Match";
        const All: string = "All";

        const taskParameters: TaskParameters = new TaskParameters();
        let connectedService: string;

        const profile: string = tl.getInput("FileContentProfile", false) || FileContentProfileConstants.Default;
        if (profile != FileContentProfileConstants.Default &&
            profile != FileContentProfileConstants.KVSet) {
            throw new ArgumentError(tl.loc("SupportedOptionsForFileContentProfile", FileContentProfileConstants.Default, FileContentProfileConstants.KVSet));
        }

        taskParameters.profile = profile;
        taskParameters.useFilePathExtension = tl.getBoolInput("UseFilePathExtension", false);
        try {
            taskParameters.configStoreUrl = this.trimTrailingSlash(tl.getInput("AppConfigurationEndpoint", true));
            taskParameters.strict = tl.getBoolInput("Strict", true);
            connectedService = tl.getInput("ConnectedServiceName", true);
            taskParameters.filePath = tl.getPathInput("ConfigurationFile", true);
            taskParameters.fileFormat = tl.getInput("FileFormat", !taskParameters.useFilePathExtension);
        }
        catch (e) {
            throw new ArgumentError(`${e.message}`);
        }

        taskParameters.separator = tl.getInput("Separator", false);
        taskParameters.prefix = tl.getInput("Prefix", false);
        taskParameters.label = tl.getInput("Label", false);
        taskParameters.contentType = tl.getInput("ContentType", false);
        taskParameters.depth = Number(tl.getInput("Depth", false));
        taskParameters.excludeFeatureFlags = tl.getBoolInput("ExcludeFeatureFlags", false);
        taskParameters.dryRun = tl.getBoolInput("DryRun", false);
        const importMode: string = tl.getInput("ImportMode", false);
        taskParameters.fileFormat = tl.getInput("FileFormat", false);
        taskParameters.endpoint =  await new AzureRMEndpoint(connectedService).getEndpoint();
        
        taskParameters.credential = new ConnectedServiceCredential(taskParameters.endpoint, taskParameters.configStoreUrl);
                        
        const tags: string = tl.getInput("Tags", false);

        if (taskParameters.profile == FileContentProfileConstants.KVSet && 
            ( taskParameters.separator || 
              taskParameters.label  || 
              taskParameters.contentType || 
              tags ||  
              taskParameters.depth ||
              taskParameters.prefix)) {

            throw new ArgumentError(tl.loc("UnsupportedOptionsForKVSetProfile", taskParameters.profile));
        }
        
        if (importMode && !(importMode == IgnoreMatch || importMode == All)) {
            throw new ArgumentError(tl.loc("OnlySupportedImportModeOptions", All, IgnoreMatch));
        }

        taskParameters.importMode = importMode == All ? ImportMode.All: ImportMode.IgnoreMatch;

        try {

            taskParameters.tags = tags ? JSON.parse(tags) : undefined;
        }
        catch {

            throw new ParseError(tl.loc("InvalidTagFormat"));
        }

        if (!!taskParameters.tags && (!isObject(taskParameters.tags) || Array.isArray(taskParameters.tags))) {

            throw new ParseError(tl.loc("InvalidTagsWithSample"));
        }

        //
        // Verify that a config store endpoint was provided, a user could input store name instead of configstore endpoint.
        if (!taskParameters.configStoreUrl.startsWith("https://")){
            
            throw new ArgumentError(tl.loc("InvalidAppConfigurationEndpoint", taskParameters.configStoreUrl));
        }

        for (const tag in taskParameters.tags) {

            if (Object.prototype.hasOwnProperty.call(taskParameters.tags, tag) && !isString(taskParameters.tags[tag])) {

                throw new ParseError(tl.loc("InvalidTypeInTags"));
            }
        }

        taskParameters.enableRiskAnalysis = tl.getBoolInput("EnableRiskAnalysis", false);

        return taskParameters;
    }

    private static trimTrailingSlash(endpoint: string): string {
        if (endpoint.endsWith("/")) {
            return endpoint.slice(0,-1)
        }
        return endpoint;
    }
}