import * as tl from "azure-pipelines-task-lib/task";
import { isObject, isString } from "lodash";
import { ConfigurationSettingsFilter, KnownSnapshotComposition } from "@azure/app-configuration";
import { AzureRMEndpoint } from "azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint";
import { AzureEndpoint } from "azure-pipelines-tasks-azure-arm-rest/azureModels";
import { ConnectedServiceCredential } from "./connectedServiceCredential";
import { ArgumentError, ParseError } from "./errors";
import { SnapshotFilter, Tags } from "./models";

export class TaskParameters {
    public configStoreUrl: string;
    public snapshotName: string;
    public compositionType: KnownSnapshotComposition;
    public filters: ConfigurationSettingsFilter[];
    public retentionPeriod: number;
    public tags: Tags;
    public credential: ConnectedServiceCredential;
    public endpoint: AzureEndpoint;

    public static async initialize(): Promise<TaskParameters> {
        const taskParameters: TaskParameters = new TaskParameters();
        let compositionType: string;
        let filters: string;

        try {
            taskParameters.configStoreUrl = this.trimTrailingSlash(tl.getInput("AppConfigurationEndpoint", true));
            taskParameters.snapshotName = tl.getInput("SnapshotName", true);
            compositionType = tl.getInput("CompositionType", true);
            filters = tl.getInput("Filters", true);
        }
        catch (error: any) {
            throw new ArgumentError(`${error.message}`);
        }

        if (compositionType && !(compositionType == KnownSnapshotComposition.Key || compositionType == KnownSnapshotComposition.KeyLabel)) {
            throw new ArgumentError(tl.loc("InvalidCompositionTypeValue", KnownSnapshotComposition.Key, KnownSnapshotComposition.KeyLabel, compositionType));
        }

        taskParameters.compositionType = compositionType == KnownSnapshotComposition.KeyLabel ? KnownSnapshotComposition.KeyLabel : KnownSnapshotComposition.Key;
        taskParameters.filters = taskParameters.getFilters(filters);

        taskParameters.tags = taskParameters.getTags(tl.getInput("Tags", false));
        taskParameters.endpoint = await new AzureRMEndpoint(tl.getInput("ConnectedServiceName", true)).getEndpoint();
        taskParameters.credential = new ConnectedServiceCredential(taskParameters.endpoint, taskParameters.configStoreUrl);
        taskParameters.retentionPeriod = taskParameters.getRetentionPeriod(Number(tl.getInput("RetentionPeriod", false)));

        return taskParameters;
    }

    private getFilters(filters: string): ConfigurationSettingsFilter[] {
        let snapshotFilters: SnapshotFilter[] = [];

        try {
            snapshotFilters = JSON.parse(filters);
        }
        catch (error: any) {
            throw new ParseError(tl.loc("InvalidFilterFormatJSONObjectExpected"));
        }

        if (snapshotFilters && (!isObject(snapshotFilters) || !Array.isArray(snapshotFilters))) {

            throw new ArgumentError(tl.loc("InvalidFilterFormat"));
        }

        if (snapshotFilters.length == 0 || snapshotFilters.length > 3) {

            throw new ArgumentError(tl.loc("MaxAndMinFiltersRequired"));
        }

        const configurationFilters: ConfigurationSettingsFilter[] = [];

        const allowedPropertyNames: string[] = ["key", "label"];

        snapshotFilters.forEach((filter: SnapshotFilter) => {
            const filterProperties: string[] = Object.keys(filter);

            if (!filterProperties.includes("key")) {
                throw new ArgumentError(tl.loc("InvalidFilterFormatKeyIsRequired"));
            }

            filterProperties.forEach((filterProperty: string) => {
                if (!allowedPropertyNames.includes(filterProperty)) {
                    throw new ArgumentError(tl.loc("InvalidFilterFormatExpectedAllowedProperties", JSON.stringify(filter)));
                }
            });

            configurationFilters.push({ keyFilter: filter.key, labelFilter: filter.label });

        });

        return configurationFilters;
    }

    private getRetentionPeriod(retentionPeriod: number): number {
        const secondsInADay: number = 86400;
        const minDays: number = 0;
        const maxDaysStandardSKU: number = 90;

        let retentionPeriodNumber: number;

        if (isNaN(retentionPeriod)) {

            throw new ArgumentError(tl.loc("RetentionPeriodNonNegativeIntegerValue"));
        }

        if (retentionPeriod < minDays || retentionPeriod > maxDaysStandardSKU) {

            throw new ArgumentError(tl.loc("MaxAndMinRetentionPeriodStandardStore", minDays, maxDaysStandardSKU));
        }
        else if (retentionPeriod == minDays) {

            retentionPeriodNumber = 3600; // minimum retention period is 1 hour
            tl.warning(tl.loc("MinRetentionAfterArchiveSnapshot"));
        }
        else {

            retentionPeriodNumber = retentionPeriod * secondsInADay;
        }

        return retentionPeriodNumber;
    }

    private getTags(tags: string): Tags {
        let tagsObject: Tags;

        try {

            tagsObject = tags ? JSON.parse(tags) : undefined;
        }
        catch {

            throw new ParseError(tl.loc("InvalidTagFormatValidJSONStringExpected"));
        }

        if (tagsObject && (!isObject(tagsObject) || Array.isArray(tagsObject))) {

            throw new ParseError(tl.loc("InvalidTagFormat"));
        }

        for (const tag in tagsObject) {

            if (Object.prototype.hasOwnProperty.call(tagsObject, tag) && !isString(tagsObject[tag])) {

                throw new ParseError(tl.loc("InvalidTagFormatOnlyStringsSupported"));
            }
        }
        return tagsObject;
    }

    private static trimTrailingSlash(endpoint: string): string {
        if (endpoint.endsWith("/")) {
            return endpoint.slice(0,-1)
        }
        return endpoint;
    }
}